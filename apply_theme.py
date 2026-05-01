import os
import re

css_path = r'd:\bot\public\static\style.css'
html_path = r'd:\bot\public\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('<html lang="en" data-theme="light">', '<html lang="en" data-theme="dark">')
html = html.replace('<body>', '<body>\n  <!-- Liquid Glass Background -->\n  <div class="liquid-bg">\n    <div class="blob blob-1"></div>\n    <div class="blob blob-2"></div>\n    <div class="blob blob-3"></div>\n  </div>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace dark theme
dark_old = '''/* Dark */
[data-theme="dark"] {
  --bg: #121212;
  --bg-grad: none;
  --bg2: #1e1e1e;
  --surface: #1e1e1e;
  --border: rgba(255, 255, 255, .05);
  --border2: rgba(255, 255, 255, .09);
  --text: #f5f5f7;
  --text2: #a1a1a6;
  --text3: #6e6e73;
  --user-bub: #2b2b2f;
  --user-txt: #ffffff;
  --ai-bub: #242426;
  --ai-txt: #f5f5f7;
  --ai-border: rgba(255, 255, 255, .04);
  --input-bg: #242426;
  --topbar-bg: rgba(18, 18, 18, .85);
  --sidebar-bg: #18181A;
  --sh-sm: 0 2px 14px rgba(0, 0, 0, .3);
  --sh-md: 0 6px 24px rgba(0, 0, 0, .45);
  --sh-lg: 0 14px 44px rgba(0, 0, 0, .6);
  --think-bg: #242426;
  --think-border: rgba(255, 255, 255, .06);
  --think-txt: #a1a1a6;
}'''

dark_new = '''/* Dark - Liquid Glass Theme */
[data-theme="dark"] {
  --bg: transparent;
  --bg-grad: none;
  --bg2: rgba(255, 255, 255, 0.05);
  --surface: rgba(255, 255, 255, 0.04);
  --border: rgba(255, 255, 255, .15);
  --border2: rgba(255, 255, 255, .25);
  --text: #ffffff;
  --text2: #eeeeee;
  --text3: #bbbbbb;
  --user-bub: rgba(255, 255, 255, 0.15);
  --user-txt: #ffffff;
  --ai-bub: rgba(0, 0, 0, 0.25);
  --ai-txt: #ffffff;
  --ai-border: rgba(255, 255, 255, .15);
  --input-bg: rgba(20, 20, 20, 0.35);
  --topbar-bg: rgba(10, 10, 10, 0.1);
  --sidebar-bg: rgba(10, 10, 10, 0.15);
  --sh-sm: 0 8px 32px rgba(0, 0, 0, .3);
  --sh-md: 0 12px 48px rgba(0, 0, 0, .4);
  --sh-lg: 0 24px 64px rgba(0, 0, 0, .5);
  --think-bg: rgba(0, 0, 0, 0.2);
  --think-border: rgba(255, 255, 255, .1);
  --think-txt: #cccccc;
}'''
css = css.replace(dark_old, dark_new)

# Add liquid bg
liquid_bg = '''
/* ── Liquid Glass Background ──────────────────────────────── */
.liquid-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  background: #02080a;
  overflow: hidden;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.7;
  animation: float 15s ease-in-out infinite alternate;
}
.blob-1 {
  width: 45vw;
  height: 45vw;
  background: #ff3333;
  top: -15vw;
  right: -10vw;
  animation-delay: 0s;
}
.blob-2 {
  width: 35vw;
  height: 35vw;
  background: #00e5ff;
  bottom: -10vw;
  left: -5vw;
  animation-delay: -5s;
}
.blob-3 {
  width: 50vw;
  height: 50vw;
  background: #ffaa00;
  top: 30%;
  left: 20%;
  opacity: 0.45;
  animation-delay: -10s;
}
@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(6vw, 10vh) scale(1.15); }
}
'''
if "liquid-bg" not in css:
    css += liquid_bg

# Blurs
css = css.replace('overflow: hidden;\n}', 'overflow: hidden;\n  backdrop-filter: blur(28px);\n  -webkit-backdrop-filter: blur(28px);\n}') # Sidebar
css = css.replace('backdrop-filter: blur(14px);', 'backdrop-filter: blur(28px);\n  -webkit-backdrop-filter: blur(28px);') # Topbar
css = css.replace('box-shadow: var(--sh-sm);\n  transition: border-color .18s, background .18s, transform .18s, color .18s;\n}', 'box-shadow: var(--sh-sm);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  transition: border-color .18s, background .18s, transform .18s, color .18s;\n}') # s-card
css = css.replace('box-shadow: var(--sh-sm);\n  transition: border-color .18s, box-shadow .18s;\n}', 'box-shadow: var(--sh-sm);\n  backdrop-filter: blur(24px);\n  -webkit-backdrop-filter: blur(24px);\n  transition: border-color .18s, box-shadow .18s;\n}') # input-box
css = css.replace('max-width: 100%;\n}', 'max-width: 100%;\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n}') # bubble

# Make backgrounds transparent so blobs show through
css = css.replace('background: var(--bg);\n}', 'background: transparent;\n}') # This replaces body, main, input-area bg

# Adjust specific elements that might look bad
css = css.replace('[data-theme="dark"] .s-card:hover {\n  background: rgba(255, 215, 94, .08);\n  color: var(--g2);\n  border-color: rgba(255, 215, 94, .3);\n}', '[data-theme="dark"] .s-card:hover {\n  background: rgba(255, 255, 255, .15);\n  color: #fff;\n  border-color: rgba(255, 255, 255, .4);\n}')
css = css.replace('[data-theme="dark"] .chat-item.active {\n  background: rgba(255, 215, 94, .12);\n  color: var(--g2);\n  border-color: rgba(255, 215, 94, .2);\n}', '[data-theme="dark"] .chat-item.active {\n  background: rgba(255, 255, 255, .2);\n  color: #fff;\n  border-color: rgba(255, 255, 255, .4);\n}')

# Search input in sidebar
css = css.replace('background: var(--bg2);\n  border: 1px solid var(--border);\n  border-radius: var(--r-sm);\n  color: var(--text);', 'background: rgba(0,0,0,0.2);\n  border: 1px solid rgba(255,255,255,0.15);\n  border-radius: var(--r-sm);\n  color: var(--text);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);')

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)
print('Done!')
