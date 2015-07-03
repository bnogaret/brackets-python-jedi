"""
Like described in the :mod:`jedi.parser.tree` module,
there's a need for an ast like module to represent the states of parsed
modules.

But now there are also structures in Python that need a little bit more than
that. An ``Instance`` for example is only a ``Class`` before it is
instantiated. This class represents these cases.

So, why is there also a ``Class`` class here? Well, there are decorators and
they change classes in Python 3.

Representation modules also define "magic methods". Those methods look like
``py__foo__`` and are typically mappable to the Python equivalents ``__call__``
and others. Here's a list:

====================================== ========================================
**Method**                             **Description**
-------------------------------------- ----------------------------------------
py__call__(evaluator, params: Array)   On callable objects, returns types.
py__bool__()                           Returns True/False/None; None means that
                                       there's no certainty.
py__bases__(evaluator)                 Returns a list of base classes.
py__mro__(evaluator)                   Returns a list of classes (the mro).
py__getattribute__(evaluator, name)    Returns a list of attribute values. The
                                       name can be str or Name.
====================================== ========================================

__
"""
import os
import pkgutil
import imp
import re
from itertools import chain

from jedi._compatibility import use_metaclass, unicode, Python3Method
from jedi.parser import tree
from jedi import debug
from jedi import common
from jedi.cache import underscore_memoization, cache_star_import
from jedi.evaluate.cache import memoize_default, CachedMetaClass, NO_DEFAULT
from jedi.evaluate import compiled
from jedi.evaluate import recursion
from jedi.evaluate import iterable
from jedi.evaluate import docstrings
from jedi.evaluate import helpers
from jedi.evaluate import param
from jedi.evaluate import flow_analysis
from jedi.evaluate import imports


class Executed(tree.Base):
    """
    An instance is also an executable - because __init__ is called
    :param var_args: The param input array, consist of a parser node or a list.
    """
    def __init__(self, evaluator, base, var_args=()):
        self._evaluator = evaluator
        self.base = base
        self.var_args = var_args

    def is_scope(self):
        return True

    def get_parent_until(self, *args, **kwargs):
        return tree.Base.get_parent_until(self, *args, **kwargs)

    @common.safe_property
    def parent(self):
        return self.base.parent


class Instance(use_metaclass(CachedMetaClass, Executed)):
    """
    This class is used to evaluate instances.
    """
    def __init__(self, evaluator, base, var_args, is_generated=False):
        super(Instance, self).__init__(evaluator, base, var_args)
        self.decorates = None
        # Generated instances are classes that are just generated by self
        # (No var_args) used.
        self.is_generated = is_generated

        if base.name.get_code() in ['list', 'set'] \
                and compiled.builtin == base.get_parent_until():
            # compare the module path with the builtin name.
            self.var_args = iterable.check_array_instances(evaluator, self)
        elif not is_generated:
            # Need to execute the __init__ function, because the dynamic param
            # searching needs it.
            try:
                method = self.get_subscope_by_name('__init__')
            except KeyError:
                pass
            else:
                evaluator.execute(method, self.var_args)

    @property
    def py__call__(self):
        def actual(evaluator, params):
            return evaluator.execute(method, params)

        try:
            method = self.get_subscope_by_name('__call__')
        except KeyError:
            # Means the Instance is not callable.
            raise AttributeError

        return actual

    def py__class__(self, evaluator):
        return self.base

    def py__bool__(self):
        # Signalize that we don't know about the bool type.
        return None

    @memoize_default()
    def _get_method_execution(self, func):
        func = get_instance_el(self._evaluator, self, func, True)
        return FunctionExecution(self._evaluator, func, self.var_args)

    def _get_func_self_name(self, func):
        """
        Returns the name of the first param in a class method (which is
        normally self.
        """
        try:
            return str(func.params[0].name)
        except IndexError:
            return None

    def _self_names_dict(self, add_mro=True):
        names = {}
        # This loop adds the names of the self object, copies them and removes
        # the self.
        for sub in self.base.subscopes:
            if isinstance(sub, tree.Class):
                continue
            # Get the self name, if there's one.
            self_name = self._get_func_self_name(sub)
            if self_name is None:
                continue

            if sub.name.value == '__init__' and not self.is_generated:
                # ``__init__`` is special because the params need are injected
                # this way. Therefore an execution is necessary.
                if not sub.get_decorators():
                    # __init__ decorators should generally just be ignored,
                    # because to follow them and their self variables is too
                    # complicated.
                    sub = self._get_method_execution(sub)
            for name_list in sub.names_dict.values():
                for name in name_list:
                    if name.value == self_name and name.prev_sibling() is None:
                        trailer = name.next_sibling()
                        if tree.is_node(trailer, 'trailer') \
                                and len(trailer.children) == 2 \
                                and trailer.children[0] == '.':
                            name = trailer.children[1]  # After dot.
                            if name.is_definition():
                                arr = names.setdefault(name.value, [])
                                arr.append(get_instance_el(self._evaluator, self, name))
        return names

    def get_subscope_by_name(self, name):
        sub = self.base.get_subscope_by_name(name)
        return get_instance_el(self._evaluator, self, sub, True)

    def execute_subscope_by_name(self, name, *args):
        method = self.get_subscope_by_name(name)
        return self._evaluator.execute_evaluated(method, *args)

    def get_descriptor_returns(self, obj):
        """ Throws a KeyError if there's no method. """
        # Arguments in __get__ descriptors are obj, class.
        # `method` is the new parent of the array, don't know if that's good.
        args = [obj, obj.base] if isinstance(obj, Instance) else [compiled.none_obj, obj]
        try:
            return self.execute_subscope_by_name('__get__', *args)
        except KeyError:
            return [self]

    @memoize_default()
    def names_dicts(self, search_global):
        yield self._self_names_dict()

        for s in self.base.py__mro__(self._evaluator)[1:]:
            if not isinstance(s, compiled.CompiledObject):
                # Compiled objects don't have `self.` names.
                for inst in self._evaluator.execute(s):
                    yield inst._self_names_dict(add_mro=False)

        for names_dict in self.base.names_dicts(search_global=False, is_instance=True):
            yield LazyInstanceDict(self._evaluator, self, names_dict)

    def get_index_types(self, evaluator, index_array):
        indexes = iterable.create_indexes_or_slices(self._evaluator, index_array)
        if any([isinstance(i, iterable.Slice) for i in indexes]):
            # Slice support in Jedi is very marginal, at the moment, so just
            # ignore them in case of __getitem__.
            # TODO support slices in a more general way.
            indexes = []

        try:
            method = self.get_subscope_by_name('__getitem__')
        except KeyError:
            debug.warning('No __getitem__, cannot access the array.')
            return []
        else:
            return self._evaluator.execute(method, [iterable.AlreadyEvaluated(indexes)])

    @property
    @underscore_memoization
    def name(self):
        name = self.base.name
        return helpers.FakeName(unicode(name), self, name.start_pos)

    def __getattr__(self, name):
        if name not in ['start_pos', 'end_pos', 'get_imports', 'type',
                        'doc', 'raw_doc']:
            raise AttributeError("Instance %s: Don't touch this (%s)!"
                                 % (self, name))
        return getattr(self.base, name)

    def __repr__(self):
        dec = ''
        if self.decorates is not None:
            dec = " decorates " + repr(self.decorates)
        return "<e%s of %s(%s)%s>" % (type(self).__name__, self.base,
                                      self.var_args, dec)


class LazyInstanceDict(object):
    def __init__(self, evaluator, instance, dct):
        self._evaluator = evaluator
        self._instance = instance
        self._dct = dct

    def __getitem__(self, name):
        return [get_instance_el(self._evaluator, self._instance, var, True)
                for var in self._dct[name]]

    def values(self):
        return [self[key] for key in self._dct]


class InstanceName(tree.Name):
    def __init__(self, origin_name, parent):
        super(InstanceName, self).__init__(tree.zero_position_modifier,
                                           origin_name.value,
                                           origin_name.start_pos)
        self._origin_name = origin_name
        self.parent = parent

    def is_definition(self):
        return self._origin_name.is_definition()


def get_instance_el(evaluator, instance, var, is_class_var=False):
    """
    Returns an InstanceElement if it makes sense, otherwise leaves the object
    untouched.

    Basically having an InstanceElement is context information. That is needed
    in quite a lot of cases, which includes Nodes like ``power``, that need to
    know where a self name comes from for example.
    """
    if isinstance(var, tree.Name):
        parent = get_instance_el(evaluator, instance, var.parent, is_class_var)
        return InstanceName(var, parent)
    elif var.type != 'funcdef' \
            and isinstance(var, (Instance, compiled.CompiledObject, tree.Leaf,
                           tree.Module, FunctionExecution)):
        return var

    var = evaluator.wrap(var)
    return InstanceElement(evaluator, instance, var, is_class_var)


class InstanceElement(use_metaclass(CachedMetaClass, tree.Base)):
    """
    InstanceElement is a wrapper for any object, that is used as an instance
    variable (e.g. self.variable or class methods).
    """
    def __init__(self, evaluator, instance, var, is_class_var):
        self._evaluator = evaluator
        self.instance = instance
        self.var = var
        self.is_class_var = is_class_var

    @common.safe_property
    @memoize_default()
    def parent(self):
        par = self.var.parent
        if isinstance(par, Class) and par == self.instance.base \
                or isinstance(par, tree.Class) \
                and par == self.instance.base.base:
            par = self.instance
        else:
            par = get_instance_el(self._evaluator, self.instance, par,
                                  self.is_class_var)
        return par

    def get_parent_until(self, *args, **kwargs):
        return tree.BaseNode.get_parent_until(self, *args, **kwargs)

    def get_definition(self):
        return self.get_parent_until((tree.ExprStmt, tree.IsScope, tree.Import))

    def get_decorated_func(self):
        """ Needed because the InstanceElement should not be stripped """
        func = self.var.get_decorated_func()
        func = get_instance_el(self._evaluator, self.instance, func)
        return func

    def get_rhs(self):
        return get_instance_el(self._evaluator, self.instance,
                               self.var.get_rhs(), self.is_class_var)

    def is_definition(self):
        return self.var.is_definition()

    @property
    def children(self):
        # Copy and modify the array.
        return [get_instance_el(self._evaluator, self.instance, command, self.is_class_var)
                for command in self.var.children]

    @property
    @memoize_default()
    def name(self):
        name = self.var.name
        return helpers.FakeName(unicode(name), self, name.start_pos)

    def __iter__(self):
        for el in self.var.__iter__():
            yield get_instance_el(self._evaluator, self.instance, el,
                                  self.is_class_var)

    def __getitem__(self, index):
        return get_instance_el(self._evaluator, self.instance, self.var[index],
                               self.is_class_var)

    def __getattr__(self, name):
        return getattr(self.var, name)

    def isinstance(self, *cls):
        return isinstance(self.var, cls)

    def is_scope(self):
        """
        Since we inherit from Base, it would overwrite the action we want here.
        """
        return self.var.is_scope()

    def py__call__(self, evaluator, params):
        if isinstance(self.var, compiled.CompiledObject):
            # This check is a bit strange, but CompiledObject itself is a bit
            # more complicated than we would it actually like to be.
            return self.var.py__call__(evaluator, params)
        else:
            return Function.py__call__(self, evaluator, params)

    def __repr__(self):
        return "<%s of %s>" % (type(self).__name__, self.var)


class Wrapper(tree.Base):
    def is_scope(self):
        return True

    def is_class(self):
        return False

    def py__bool__(self):
        """
        Since Wrapper is a super class for classes, functions and modules,
        the return value will always be true.
        """
        return True

    @property
    @underscore_memoization
    def name(self):
        name = self.base.name
        return helpers.FakeName(unicode(name), self, name.start_pos)


class Class(use_metaclass(CachedMetaClass, Wrapper)):
    """
    This class is not only important to extend `tree.Class`, it is also a
    important for descriptors (if the descriptor methods are evaluated or not).
    """
    def __init__(self, evaluator, base):
        self._evaluator = evaluator
        self.base = base

    @memoize_default(default=())
    def py__mro__(self, evaluator):
        def add(cls):
            if cls not in mro:
                mro.append(cls)

        mro = [self]
        # TODO Do a proper mro resolution. Currently we are just listing
        # classes. However, it's a complicated algorithm.
        for cls in self.py__bases__(self._evaluator):
            # TODO detect for TypeError: duplicate base class str,
            # e.g.  `class X(str, str): pass`
            try:
                mro_method = cls.py__mro__
            except AttributeError:
                # TODO add a TypeError like:
                """
                >>> class Y(lambda: test): pass
                Traceback (most recent call last):
                  File "<stdin>", line 1, in <module>
                TypeError: function() argument 1 must be code, not str
                >>> class Y(1): pass
                Traceback (most recent call last):
                  File "<stdin>", line 1, in <module>
                TypeError: int() takes at most 2 arguments (3 given)
                """
                pass
            else:
                add(cls)
                for cls_new in mro_method(evaluator):
                    add(cls_new)
        return tuple(mro)

    @memoize_default(default=())
    def py__bases__(self, evaluator):
        arglist = self.base.get_super_arglist()
        if arglist:
            args = param.Arguments(self._evaluator, arglist)
            return list(chain.from_iterable(args.eval_args()))
        else:
            return [compiled.object_obj]

    def py__call__(self, evaluator, params):
        return [Instance(evaluator, self, params)]

    def py__getattribute__(self, name):
        return self._evaluator.find_types(self, name)

    @property
    def params(self):
        return self.get_subscope_by_name('__init__').params

    def names_dicts(self, search_global, is_instance=False):
        if search_global:
            yield self.names_dict
        else:
            for scope in self.py__mro__(self._evaluator):
                if isinstance(scope, compiled.CompiledObject):
                    yield scope.names_dicts(False, is_instance)[0]
                else:
                    yield scope.names_dict

    def is_class(self):
        return True

    def get_subscope_by_name(self, name):
        for s in self.py__mro__(self._evaluator):
            for sub in reversed(s.subscopes):
                if sub.name.value == name:
                        return sub
        raise KeyError("Couldn't find subscope.")

    def __getattr__(self, name):
        if name not in ['start_pos', 'end_pos', 'parent', 'raw_doc',
                        'doc', 'get_imports', 'get_parent_until', 'get_code',
                        'subscopes', 'names_dict', 'type']:
            raise AttributeError("Don't touch this: %s of %s !" % (name, self))
        return getattr(self.base, name)

    def __repr__(self):
        return "<e%s of %s>" % (type(self).__name__, self.base)


class Function(use_metaclass(CachedMetaClass, Wrapper)):
    """
    Needed because of decorators. Decorators are evaluated here.
    """
    def __init__(self, evaluator, func, is_decorated=False):
        """ This should not be called directly """
        self._evaluator = evaluator
        self.base = self.base_func = func
        self.is_decorated = is_decorated
        # A property that is set by the decorator resolution.
        self.decorates = None

    @memoize_default()
    def get_decorated_func(self):
        """
        Returns the function, that should to be executed in the end.
        This is also the places where the decorators are processed.
        """
        f = self.base_func
        decorators = self.base_func.get_decorators()

        if not decorators or self.is_decorated:
            return self

        # Only enter it, if has not already been processed.
        if not self.is_decorated:
            for dec in reversed(decorators):
                debug.dbg('decorator: %s %s', dec, f)
                dec_results = self._evaluator.eval_element(dec.children[1])
                trailer = dec.children[2:-1]
                if trailer:
                    # Create a trailer and evaluate it.
                    trailer = tree.Node('trailer', trailer)
                    trailer.parent = dec
                    dec_results = self._evaluator.eval_trailer(dec_results, trailer)

                if not len(dec_results):
                    debug.warning('decorator not found: %s on %s', dec, self.base_func)
                    return self
                decorator = dec_results.pop()
                if dec_results:
                    debug.warning('multiple decorators found %s %s',
                                  self.base_func, dec_results)

                # Create param array.
                if isinstance(f, Function):
                    old_func = f  # TODO this is just hacky. change.
                else:
                    old_func = Function(self._evaluator, f, is_decorated=True)

                wrappers = self._evaluator.execute_evaluated(decorator, old_func)
                if not len(wrappers):
                    debug.warning('no wrappers found %s', self.base_func)
                    return self
                if len(wrappers) > 1:
                    # TODO resolve issue with multiple wrappers -> multiple types
                    debug.warning('multiple wrappers found %s %s',
                                  self.base_func, wrappers)
                f = wrappers[0]
                if isinstance(f, (Instance, Function)):
                    f.decorates = self

                debug.dbg('decorator end %s', f)
        return f

    def names_dicts(self, search_global):
        if search_global:
            yield self.names_dict
        else:
            for names_dict in compiled.magic_function_class.names_dicts(False):
                yield names_dict

    @Python3Method
    def py__call__(self, evaluator, params):
        if self.base.is_generator():
            return [iterable.Generator(evaluator, self, params)]
        else:
            return FunctionExecution(evaluator, self, params).get_return_types()

    def __getattr__(self, name):
        return getattr(self.base_func, name)

    def __repr__(self):
        dec = ''
        if self.decorates is not None:
            dec = " decorates " + repr(self.decorates)
        return "<e%s of %s%s>" % (type(self).__name__, self.base_func, dec)


class LambdaWrapper(Function):
    def get_decorated_func(self):
        return self


class FunctionExecution(Executed):
    """
    This class is used to evaluate functions and their returns.

    This is the most complicated class, because it contains the logic to
    transfer parameters. It is even more complicated, because there may be
    multiple calls to functions and recursion has to be avoided. But this is
    responsibility of the decorators.
    """
    type = 'funcdef'

    def __init__(self, evaluator, base, *args, **kwargs):
        super(FunctionExecution, self).__init__(evaluator, base, *args, **kwargs)
        self._copy_dict = {}
        new_func = helpers.deep_ast_copy(base.base_func, self, self._copy_dict)
        self.children = new_func.children
        self.names_dict = new_func.names_dict

    @memoize_default(default=())
    @recursion.execution_recursion_decorator
    def get_return_types(self, check_yields=False):
        func = self.base

        if func.isinstance(LambdaWrapper):
            return self._evaluator.eval_element(self.children[-1])

        if func.listeners:
            # Feed the listeners, with the params.
            for listener in func.listeners:
                listener.execute(self._get_params())
            # If we do have listeners, that means that there's not a regular
            # execution ongoing. In this case Jedi is interested in the
            # inserted params, not in the actual execution of the function.
            return []

        if check_yields:
            types = []
            returns = self.yields
        else:
            returns = self.returns
            types = list(docstrings.find_return_types(self._evaluator, func))

        for r in returns:
            check = flow_analysis.break_check(self._evaluator, self, r)
            if check is flow_analysis.UNREACHABLE:
                debug.dbg('Return unreachable: %s', r)
            else:
                types += self._evaluator.eval_element(r.children[1])
            if check is flow_analysis.REACHABLE:
                debug.dbg('Return reachable: %s', r)
                break
        return types

    def names_dicts(self, search_global):
        yield self.names_dict

    @memoize_default(default=NO_DEFAULT)
    def _get_params(self):
        """
        This returns the params for an TODO and is injected as a
        'hack' into the tree.Function class.
        This needs to be here, because Instance can have __init__ functions,
        which act the same way as normal functions.
        """
        return param.get_params(self._evaluator, self.base, self.var_args)

    def param_by_name(self, name):
        return [n for n in self._get_params() if str(n) == name][0]

    def name_for_position(self, position):
        return tree.Function.name_for_position(self, position)

    def _copy_list(self, lst):
        """
        Copies a list attribute of a parser Function. Copying is very
        expensive, because it is something like `copy.deepcopy`. However, these
        copied objects can be used for the executions, as if they were in the
        execution.
        """
        objects = []
        for element in lst:
            self._scope_copy(element.parent)
            copied = helpers.deep_ast_copy(element, self._copy_dict)
            objects.append(copied)
        return objects

    def __getattr__(self, name):
        if name not in ['start_pos', 'end_pos', 'imports', 'name', 'type']:
            raise AttributeError('Tried to access %s: %s. Why?' % (name, self))
        return getattr(self.base, name)

    def _scope_copy(self, scope):
        raise NotImplementedError
        """ Copies a scope (e.g. `if foo:`) in an execution """
        if scope != self.base.base_func:
            # Just make sure the parents been copied.
            self._scope_copy(scope.parent)
            helpers.deep_ast_copy(scope, self._copy_dict)

    @common.safe_property
    @memoize_default([])
    def returns(self):
        return tree.Scope._search_in_scope(self, tree.ReturnStmt)

    @common.safe_property
    @memoize_default([])
    def yields(self):
        return tree.Scope._search_in_scope(self, tree.YieldExpr)

    @common.safe_property
    @memoize_default([])
    def statements(self):
        return tree.Scope._search_in_scope(self, tree.ExprStmt)

    @common.safe_property
    @memoize_default([])
    def subscopes(self):
        return tree.Scope._search_in_scope(self, tree.Scope)

    def __repr__(self):
        return "<%s of %s>" % (type(self).__name__, self.base)


class GlobalName(helpers.FakeName):
    def __init__(self, name):
        """
        We need to mark global names somehow. Otherwise they are just normal
        names that are not definitions.
        """
        super(GlobalName, self).__init__(name.value, name.parent,
                                         name.start_pos, is_definition=True)


class ModuleWrapper(use_metaclass(CachedMetaClass, tree.Module, Wrapper)):
    def __init__(self, evaluator, module):
        self._evaluator = evaluator
        self.base = self._module = module

    def names_dicts(self, search_global):
        yield self.base.names_dict
        yield self._module_attributes_dict()

        for star_module in self.star_imports():
            yield star_module.names_dict

        yield dict((str(n), [GlobalName(n)]) for n in self.base.global_names)
        yield self._sub_modules_dict()

    # I'm not sure if the star import cache is really that effective anymore
    # with all the other really fast import caches. Recheck. Also we would need
    # to push the star imports into Evaluator.modules, if we reenable this.
    #@cache_star_import
    @memoize_default([])
    def star_imports(self):
        modules = []
        for i in self.base.imports:
            if i.is_star_import():
                name = i.star_import_name()
                new = imports.ImportWrapper(self._evaluator, name).follow()
                for module in new:
                    if isinstance(module, tree.Module):
                        modules += module.star_imports()
                modules += new
        return modules

    @memoize_default()
    def _module_attributes_dict(self):
        def parent_callback():
            return self._evaluator.execute(compiled.create(self._evaluator, str))[0]

        names = ['__file__', '__package__', '__doc__', '__name__']
        # All the additional module attributes are strings.
        return dict((n, [helpers.LazyName(n, parent_callback, is_definition=True)])
                    for n in names)

    @property
    @memoize_default()
    def name(self):
        return helpers.FakeName(unicode(self.base.name), self, (1, 0))

    def _get_init_directory(self):
        for suffix, _, _ in imp.get_suffixes():
            ending = '__init__' + suffix
            if self.py__file__().endswith(ending):
                # Remove the ending, including the separator.
                return self.py__file__()[:-len(ending) - 1]
        return None

    def py__name__(self):
        for name, module in self._evaluator.modules.items():
            if module == self:
                return name

        return '__main__'

    def py__file__(self):
        """
        In contrast to Python's __file__ can be None.
        """
        if self._module.path is None:
            return None

        return os.path.abspath(self._module.path)

    def py__package__(self):
        if self._get_init_directory() is None:
            return re.sub(r'\.?[^\.]+$', '', self.py__name__())
        else:
            return self.py__name__()

    @property
    def py__path__(self):
        """
        Not seen here, since it's a property. The callback actually uses a
        variable, so use it like::

            foo.py__path__(sys_path)

        In case of a package, this returns Python's __path__ attribute, which
        is a list of paths (strings).
        Raises an AttributeError if the module is not a package.
        """
        def return_value(search_path):
            init_path = self.py__file__()
            if os.path.basename(init_path) == '__init__.py':

                with open(init_path, 'rb') as f:
                    content = common.source_to_unicode(f.read())
                    # these are strings that need to be used for namespace packages,
                    # the first one is ``pkgutil``, the second ``pkg_resources``.
                    options = ('declare_namespace(__name__)', 'extend_path(__path__')
                    if options[0] in content or options[1] in content:
                        # It is a namespace, now try to find the rest of the
                        # modules on sys_path or whatever the search_path is.
                        paths = set()
                        for s in search_path:
                            other = os.path.join(s, unicode(self.name))
                            if os.path.isdir(other):
                                paths.add(other)
                        return list(paths)
            # Default to this.
            return [path]

        path = self._get_init_directory()

        if path is None:
            raise AttributeError('Only packages have __path__ attributes.')
        else:
            return return_value

    @memoize_default()
    def _sub_modules_dict(self):
        """
        Lists modules in the directory of this module (if this module is a
        package).
        """
        path = self._module.path
        names = {}
        if path is not None and path.endswith(os.path.sep + '__init__.py'):
            mods = pkgutil.iter_modules([os.path.dirname(path)])
            for module_loader, name, is_pkg in mods:
                fake_n = helpers.FakeName(name)
                # It's obviously a relative import to the current module.
                imp = helpers.FakeImport(fake_n, self, level=1)
                fake_n.parent = imp
                names[name] = [fake_n]

        # TODO add something like this in the future, its cleaner than the
        #   import hacks.
        # ``os.path`` is a hardcoded exception, because it's a
        # ``sys.modules`` modification.
        #if str(self.name) == 'os':
        #    names.append(helpers.FakeName('path', parent=self))

        return names

    def __getattr__(self, name):
        return getattr(self._module, name)

    def __repr__(self):
        return "<%s: %s>" % (type(self).__name__, self._module)
