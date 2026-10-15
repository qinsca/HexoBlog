# -*- coding: utf-8 -*-
"""生成 hexo-theme-arknights 所需的头像 / favicon / 背景资源。

用法（在 blog/ 目录下）：
    python tools/make_assets.py

数据来源：source/images/qsc.jpg（原始头像）
产出：
    source/images/qsc-avatar.png      侧边栏头像（圆形，替代罗德岛图标）
    source/images/qsc-avatar-180.png  小尺寸头像
    source/images/qsc-favicon-*.png   站点图标
    source/favicon.ico                浏览器标签页图标（主题要求 <= 64x64）
    source/images/ak/bk-light.jpg     白天背景
    source/images/ak/bk-dark.jpg      夜间背景（本地化，避免外链失效）
"""
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageStat

# tools/ 的上一级就是 Hexo 站点根目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "source")
IMAGES = os.path.join(SOURCE, "images")
AK = os.path.join(IMAGES, "ak")
THEME_IMG = os.path.join(ROOT, "themes", "arknights", "source", "img")
os.makedirs(AK, exist_ok=True)

AVATAR = os.path.join(IMAGES, "qsc.jpg")


def circular(src, size, out, zoom=1.0):
    """裁成正方形 -> 圆形（透明底）-> 输出 PNG。"""
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    if zoom != 1.0:
        new_side = int(side / zoom)
        off = (new_side - side) // 2
        im = im.resize((new_side, new_side), Image.LANCZOS).crop(
            (off, off, off + side, off + side)
        )
    im = im.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out_im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out_im.paste(im, (0, 0), mask)
    out_im.save(out, "PNG", optimize=True)
    print("written", out, out_im.size)


def square(src, size, out, zoom=1.0):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2, (w - side) // 2 + side, (h - side) // 2 + side))
    im = im.resize((size, size), Image.LANCZOS)
    im.save(out, "PNG", optimize=True)
    print("written", out, im.size)


def darken(src, out, brightness=0.42, saturation=0.85, blur=1.2, size=(1920, 1080)):
    im = Image.open(src).convert("RGB")
    # 居中裁成 16:9
    w, h = im.size
    target_ratio = size[0] / size[1]
    if w / h > target_ratio:
        new_w = int(h * target_ratio)
        im = im.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        im = im.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
    im = im.resize(size, Image.LANCZOS)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    im = ImageEnhance.Brightness(im).enhance(brightness)
    im = ImageEnhance.Color(im).enhance(saturation)
    im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print("written", out, im.size,
          round(os.path.getsize(out) / 1024, 1), "KB")


# ---------------------------------------------------------------------------
# 背景图：白天要够亮、夜间要够深（都经过亮度标定，见下方 mean luma 输出）
# ---------------------------------------------------------------------------
SIZE = (1920, 1080)


def _fit(im, size=SIZE):
    im = im.convert("RGB")
    w, h = im.size
    ratio = size[0] / size[1]
    if w / h > ratio:
        nw = int(h * ratio)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ratio)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize(size, Image.LANCZOS)


def _vignette(im, mode, strength=0.6):
    """中心亮、四周暗的径向遮罩，让背景退到视觉次要层。"""
    mask = Image.new("L", (512, 288), 0)
    d = ImageDraw.Draw(mask)
    steps = 60
    for i in range(steps, 0, -1):
        t = i / steps
        v = int(255 * (1 - t) ** 1.6 * strength)
        d.ellipse((256 - 256 * t * 1.35, 144 - 144 * t * 1.35,
                   256 + 256 * t * 1.35, 144 + 144 * t * 1.35), fill=v)
    mask = mask.resize(im.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(60))
    color = (255, 255, 255) if mode == "light" else (0, 0, 0)
    return Image.composite(Image.new("RGB", im.size, color), im, mask)


def _luma(im):
    return round(ImageStat.Stat(im.convert("L")).mean[0], 1)


def build_light_bg(src, out):
    """白天背景：大幅去色 + 提亮 + 冷调白柔光，目标平均亮度 ≈ 172（柔和不刺眼）。"""
    im = _fit(Image.open(src))
    im = im.filter(ImageFilter.GaussianBlur(2.0))
    im = ImageEnhance.Color(im).enhance(0.16)
    im = ImageEnhance.Brightness(im).enhance(1.75)
    im = ImageEnhance.Contrast(im).enhance(0.78)
    im = _vignette(im, "light", 0.50)
    # 冷调白（#eef1f4）而不是纯白，避免整体发黄/刺眼
    im = Image.blend(im, Image.new("RGB", im.size, (238, 241, 244)), 0.60)
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print("written", out, im.size, round(os.path.getsize(out) / 1024, 1), "KB",
          "| mean luma =", _luma(im))


def build_dark_bg(src, out):
    """夜间背景：强压暗 + 黑色柔光，目标平均亮度 ≈ 12（比面板 #1a1c1f 明显更暗）。"""
    im = _fit(Image.open(src))
    im = im.filter(ImageFilter.GaussianBlur(2.4))
    im = ImageEnhance.Color(im).enhance(0.45)
    im = ImageEnhance.Brightness(im).enhance(0.16)
    im = ImageEnhance.Contrast(im).enhance(0.95)
    im = _vignette(im, "dark", 0.78)
    im = Image.blend(im, Image.new("RGB", im.size, (0, 0, 0)), 0.42)
    im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print("written", out, im.size, round(os.path.getsize(out) / 1024, 1), "KB",
          "| mean luma =", _luma(im))


def to_jpg(src, out, size=(1920, 1080), quality=86):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    target_ratio = size[0] / size[1]
    if w / h > target_ratio:
        new_w = int(h * target_ratio)
        im = im.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        im = im.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
    im = im.resize(size, Image.LANCZOS)
    im.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    print("written", out, im.size, round(os.path.getsize(out) / 1024, 1), "KB")


# 1. 侧边栏头像（罗德岛图标 -> 我的头像），1:1 圆形
circular(AVATAR, 512, os.path.join(IMAGES, "qsc-avatar.png"))
circular(AVATAR, 180, os.path.join(IMAGES, "qsc-avatar-180.png"))

# 2. favicon（主题说明：64*64，分辨率过高会显示不出）
square(AVATAR, 64, os.path.join(IMAGES, "qsc-favicon-64.png"))
square(AVATAR, 32, os.path.join(IMAGES, "qsc-favicon-32.png"))
square(AVATAR, 16, os.path.join(IMAGES, "qsc-favicon-16.png"))

ico = Image.open(AVATAR).convert("RGB")
ico = ico.resize((64, 64), Image.LANCZOS)
ico.save(os.path.join(SOURCE, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("written", os.path.join(SOURCE, "favicon.ico"))

# 3. 背景图：不再自己生成
#    _config.arknights.yml 里 background_image 直接引用主题自带的
#    /img/bg.jpg（白天，深色构图）与 /img/bk.jpg（夜间，浅色构图），
#    与主题原始设计保持一致。下面的函数保留备用，默认不执行。
# build_light_bg(os.path.join(THEME_IMG, "bg.jpg"), os.path.join(AK, "bk-light.jpg"))
# build_dark_bg(os.path.join(THEME_IMG, "bk.jpg"), os.path.join(AK, "bk-dark.jpg"))
