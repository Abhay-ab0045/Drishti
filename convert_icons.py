from PIL import Image

# Open the source JPEG
img = Image.open("drishti_logo.jpeg")

# Crop to center square (since the logo has a 16:9 ratio)
width, height = img.size
min_dim = min(width, height)
left = (width - min_dim) / 2
top = (height - min_dim) / 2
right = (width + min_dim) / 2
bottom = (height + min_dim) / 2

square_img = img.crop((left, top, right, bottom))

# Sizes needed for Chrome Manifest V3
sizes = [16, 32, 48, 128]
import os
os.makedirs("extension/assets/icons", exist_ok=True)

for size in sizes:
    resized = square_img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(f"extension/assets/icons/icon{size}.png", format="PNG")
    print(f"Generated icon{size}.png")