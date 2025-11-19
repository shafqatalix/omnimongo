"""
Generate icon files from SVG for OmniMongo app
Requires: pip install Pillow cairosvg
"""

try:
    from PIL import Image
    import cairosvg
    import io
    import os

    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, 'public')
    
    svg_path = os.path.join(public_dir, 'icon.svg')
    
    # Read SVG
    with open(svg_path, 'r') as f:
        svg_data = f.read()
    
    # Generate different sizes for ICO (Windows)
    sizes = [16, 32, 48, 64, 128, 256]
    images = []
    
    print("Generating icon images...")
    for size in sizes:
        # Convert SVG to PNG in memory
        png_data = cairosvg.svg2png(bytestring=svg_data.encode('utf-8'), 
                                     output_width=size, 
                                     output_height=size)
        img = Image.open(io.BytesIO(png_data))
        images.append(img)
        print(f"  Generated {size}x{size}")
    
    # Save as ICO (Windows)
    ico_path = os.path.join(public_dir, 'icon.ico')
    images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in sizes], append_images=images[1:])
    print(f"\nSuccessfully created: {ico_path}")
    
    # Also save a 512x512 PNG for reference
    png_512 = cairosvg.svg2png(bytestring=svg_data.encode('utf-8'), 
                               output_width=512, 
                               output_height=512)
    img_512 = Image.open(io.BytesIO(png_512))
    png_path = os.path.join(public_dir, 'icon.png')
    img_512.save(png_path, format='PNG')
    print(f"Also created: {png_path}")
    
    print("\nIcon generation complete! ✓")

except ImportError as e:
    print("Error: Required packages not installed")
    print("\nPlease install required packages:")
    print("  pip install Pillow cairosvg")
    print("\nNote: On Windows, you may also need GTK3 runtime for cairosvg")
    print("Alternative: Use an online SVG to ICO converter with the generated icon.svg file")
    
except Exception as e:
    print(f"Error generating icons: {e}")
    print("\nAlternative solution:")
    print("1. Open public/icon.svg in a browser")
    print("2. Use an online converter like https://convertio.co/svg-ico/")
    print("3. Save the result as public/icon.ico")
