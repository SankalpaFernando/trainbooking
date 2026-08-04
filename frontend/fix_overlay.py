import os
import re

directory = 'src/components'

replacements = [
    (r"background: 'rgba\(0, 0, 0, 0\.05\)'", r"background: 'var(--overlay-bg)'"),
    (r"background: 'rgba\(0, 0, 0, 0\.04\)'", r"background: 'var(--overlay-bg)'"),
    (r"background: 'rgba\(0, 0, 0, 0\.06\)'", r"background: 'var(--overlay-bg)'"),
    (r"background: 'rgba\(0, 0, 0, 0\.02\)'", r"background: 'var(--overlay-bg)'"),
    (r"background: 'rgba\(0, 0, 0, 0\.5\)'", r"background: 'var(--overlay-dark)'"),
]

for filename in os.listdir(directory):
    if filename.endswith('.tsx'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = content
        for old, new in replacements:
            new_content = re.sub(old, new, new_content)
            
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Updated {filename}")
