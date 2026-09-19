import os
import random
import shutil

SOURCE = "dataset/clean/images"

TRAIN = "dataset/clean/images/train"
VAL = "dataset/clean/images/val"
TEST = "dataset/clean/images/test"

for folder in [TRAIN, VAL, TEST]:
    os.makedirs(folder, exist_ok=True)

images = [
    f for f in os.listdir(SOURCE)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
    and f not in ["train", "val", "test"]
]

random.seed(42)
random.shuffle(images)

total = len(images)

train_end = int(total * 0.8)
val_end = int(total * 0.9)

train_images = images[:train_end]
val_images = images[train_end:val_end]
test_images = images[val_end:]

def move_images(files, destination):
    for file in files:
        shutil.move(
            os.path.join(SOURCE, file),
            os.path.join(destination, file)
        )

move_images(train_images, TRAIN)
move_images(val_images, VAL)
move_images(test_images, TEST)

print("Dataset split completed!")
print("Total:", total)
print("Train:", len(train_images))
print("Val:", len(val_images))
print("Test:", len(test_images))