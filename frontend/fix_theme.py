import os
import re

directory = 'src/components'

replacements = [
    (r"background: '#131c31'", r"background: 'var(--bg-secondary)'"),
    (r"color: '#fff'", r"color: 'var(--text-main)'"),
    (r"color: '#ffffff'", r"color: 'var(--text-main)'"),
    (r"background: 'rgba\(15, 23, 42, 0\.7\)'", r"background: 'rgba(0, 0, 0, 0.05)'"),
    (r"background: 'rgba\(15, 23, 42, 0\.6\)'", r"background: 'rgba(0, 0, 0, 0.04)'"),
    (r"background: 'rgba\(15, 23, 42, 0\.8\)'", r"background: 'rgba(0, 0, 0, 0.06)'"),
    (r"background: 'rgba\(4, 16, 30, 0\.85\)'", r"background: 'rgba(0, 0, 0, 0.5)'"),
    (r"background: '#0f172a'", r"background: 'var(--bg-secondary)'"),
    (r"background: 'rgba\(255,\s*255,\s*255,\s*0\.05\)'", r"background: 'rgba(0, 0, 0, 0.05)'"),
    (r"background: 'rgba\(255,\s*255,\s*255,\s*0\.04\)'", r"background: 'rgba(0, 0, 0, 0.04)'"),
    (r"background: 'rgba\(255,\s*255,\s*255,\s*0\.02\)'", r"background: 'rgba(0, 0, 0, 0.02)'"),
    (r"background: 'rgba\(0, 0, 0, 0\.4\)'", r"background: 'rgba(0, 0, 0, 0.04)'"),
    (r"color=\"#04101e\"", r'color="var(--bg-secondary)"'),
    (r"background: 'linear-gradient\(90deg, #ffffff, #94a3b8\)'", r"background: 'none'"),
    (r"WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'", r"color: 'var(--accent-cyan)'"),
    (r"color: '#94a3b8'", r"color: 'var(--text-muted)'"),
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
