import re

# Read the file
with open(r'c:\Users\Marcelo\Desktop\e-Traffic-System\client\src\pages\admin\Reports.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all instances of the problematic line
# The actual line in the file contains HTML entity strings like '&amp;', '&lt;', '&gt;'
old_pattern = r"return text\.replace\(/&/g, '&amp;'\)\.replace\(/<\/g, '&lt;'\)\.replace\(/>\/g, '&gt;'\);"
new_line = "return text;"

content = re.sub(old_pattern, new_line, content)

# Write the file back
with open(r'c:\Users\Marcelo\Desktop\e-Traffic-System\client\src\pages\admin\Reports.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully!')
print(f'Replacements made')
