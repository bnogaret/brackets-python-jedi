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
        list with dictionaries containing the name, docstring and description
        for all completions.
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
source = str(sys.argv[2])
line = int(sys.argv[3])
column = int(sys.argv[4])

res = json.dumps(completions(source,line,column))

print(res)

# Example :
# python jedi-complete.py /home/nogaret/.config/Brackets/extensions/user/python-jedi/python 'fo' 1 2
# python jedi-complete.py /home/nogaret/.config/Brackets/extensions/user/python-jedi/python 'import json; json.dum' 1 21
