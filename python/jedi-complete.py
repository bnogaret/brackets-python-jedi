import sys
import jedi
import json


def completions(source, line, column):
    """
    Generate list with completions for the line and column.
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the name and type for all completions.
    """
    script = jedi.api.Script(
        source=source,
        line=line,
        column=column,
    )

    completions = list()

    for completion in script.completions():
        completions.append({
            "name": completion.name,
            #"description": completion.description,
            "type" : completion.type,
            # "docstring": completion.docstring(),
        })

    return completions


documentPath = str(sys.argv[1])
sys.path.append(documentPath)
sourcePath = str(sys.argv[2])
f = open(sourcePath, "r")
line = int(sys.argv[3])
column = int(sys.argv[4])

res = json.dumps(completions(f.read(),line,column))

f.close()

print(res)

# Examples :
# python jedi-complete.py /home/nogaret/.config/Brackets/extensions/user/brackets-python-jedi/python /home/nogaret/.config/Brackets/extensions/user/brackets-python-jedi/python/jeditmp 1 2
