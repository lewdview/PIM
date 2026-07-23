import os
import shutil

src_dir = 'public/data/slideshow'
dest_dir = 'public/data/slideshow/stella'

def move_stella_images():
    if not os.path.exists(src_dir):
        print(f"Source directory {src_dir} does not exist.")
        return
        
    os.makedirs(dest_dir, exist_ok=True)
    count = 0
    for f in os.listdir(src_dir):
        f_path = os.path.join(src_dir, f)
        if os.path.isfile(f_path):
            if 'stella' in f.lower():
                shutil.move(f_path, os.path.join(dest_dir, f))
                print(f"Moved: {f} -> stella/{f}")
                count += 1
    print(f"Successfully moved {count} Stella images.")

if __name__ == '__main__':
    move_stella_images()
