import glob, os
from PIL import Image, ImageDraw
res = 'android/app/src/main/res'
icon = Image.open('tools/out-icon.png').convert('RGBA')
fg = Image.open('tools/out-fg.png').convert('RGBA')
splash = Image.open('tools/out-splash.png').convert('RGB')
for path in glob.glob(f'{res}/mipmap-*/*.png'):
    size = Image.open(path).size
    name = os.path.basename(path)
    if name == 'ic_launcher_foreground.png':
        fg.resize(size, Image.LANCZOS).save(path)
    else:
        im = icon.resize(size, Image.LANCZOS)
        if name == 'ic_launcher_round.png':
            mask = Image.new('L', size, 0)
            ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
            im.putalpha(mask)
        im.save(path)
for path in glob.glob(f'{res}/drawable*/splash.png'):
    w, h = Image.open(path).size
    # cover-crop the portrait splash into the target size
    s = max(w / splash.width, h / splash.height)
    im = splash.resize((round(splash.width * s), round(splash.height * s)), Image.LANCZOS)
    left, top = (im.width - w) // 2, (im.height - h) // 2
    im.crop((left, top, left + w, top + h)).save(path)
os.makedirs('public/icons', exist_ok=True)
icon.resize((192, 192), Image.LANCZOS).save('public/icons/icon-192.png')
icon.resize((512, 512), Image.LANCZOS).save('public/icons/icon-512.png')
print('icons written')
