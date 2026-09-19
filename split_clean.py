import os
import random
import shutil

src_images = "dataset/clean/images"
src_labels = "dataset/clean/labels"

splits = {
    "train": 0.80,
    "val": 0.10,
    "test": 0.10
}

for split in splits:
    os.makedirs(f"dataset/yolo/{split}/images", exist_ok=True)
    os.makedirs(f"dataset/yolo/{split}/labels", exist_ok=True)

files = [
    f[:-4]
    for f in os.listdir(src_images)
    if f.lower().endswith(".jpg")
    and os.path.exists(os.path.join(src_labels, f[:-4] + ".txt"))
]

random.seed(42)
random.shuffle(files)

n = len(files)

train_end = int(n * 0.80)
val_end = train_end + int(n * 0.10)

train_files = files[:train_end]
val_files = files[train_end:val_end]
test_files = files[val_end:]

def copy_files(file_list, split):
    for name in file_list:
        shutil.copy(
            os.path.join(src_images, name + ".jpg"),
            os.path.join("dataset/yolo", split, "images", name + ".jpg")
        )

        shutil.copy(
            os.path.join(src_labels, name + ".txt"),
            os.path.join("dataset/yolo", split, "labels", name + ".txt")
        )

copy_files(train_files, "train")
copy_files(val_files, "val")
copy_files(test_files, "test")

print("Clean YOLO dataset created!")
print("Total:", n)
print("Train:", len(train_files))
print("Val:", len(val_files))
print("Test:", len(test_files))