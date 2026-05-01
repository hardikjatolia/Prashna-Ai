import os
import re

html_path = r'd:\bot\public\index.html'
js_path = r'd:\bot\public\static\app.js'
css_path = r'd:\bot\public\static\style.css'

# --- HTML ---
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove themeToggle button
html = re.sub(r'<button class="icon-btn" id="themeToggle".*?</button>', '', html, flags=re.DOTALL)
# Bump versions again
html = html.replace('?v=8', '?v=9')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)


# --- JS ---
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# Replace applyTheme logic to avoid null errors when sun/moon icons are missing
# and remove themeToggle event listener
js = re.sub(r'// ── Theme ──.*?// ── Suggestions ──', 
'''// ── Theme ──────────────────────────────────────────────────
function applyTheme(t) {
  htmlEl.setAttribute('data-theme', 'dark');
  localStorage.setItem(THEME_KEY, 'dark');
}

// ── Suggestions ──''', js, flags=re.DOTALL)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)


# --- CSS ---
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Remove border creases
css = css.replace('border-right: 1px solid var(--border);', 'border-right: none;') # .sidebar
css = css.replace('border-bottom: 1px solid var(--border);', 'border-bottom: none;') # .topbar
css = css.replace('border-top: 1px solid var(--border);', 'border-top: none;') # .input-area

# 2. Make the glass borders more subtle globally in dark theme
# Also reduce background opacities a bit for a cleaner look
css = css.replace('--border: rgba(255, 255, 255, .15);', '--border: rgba(255, 255, 255, 0.04);')
css = css.replace('--border2: rgba(255, 255, 255, .25);', '--border2: rgba(255, 255, 255, 0.08);')
css = css.replace('--surface: rgba(255, 255, 255, 0.04);', '--surface: rgba(255, 255, 255, 0.02);')
css = css.replace('--input-bg: rgba(20, 20, 20, 0.35);', '--input-bg: rgba(255, 255, 255, 0.03);')
css = css.replace('--topbar-bg: rgba(10, 10, 10, 0.1);', '--topbar-bg: rgba(0, 0, 0, 0.05);')
css = css.replace('--sidebar-bg: rgba(10, 10, 10, 0.15);', '--sidebar-bg: rgba(0, 0, 0, 0.1);')

# Let's also remove light theme block entirely from CSS so it's purely dark mode
css = re.sub(r'/\* Light \*/.*?/\* Dark - Liquid Glass Theme \*/', '/* Dark - Liquid Glass Theme */', css, flags=re.DOTALL)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Clean UI changes applied.")
