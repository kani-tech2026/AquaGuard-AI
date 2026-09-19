from pathlib import Path
import random

dataset = Path("dataset")
images_dir = dataset / "images"
sets_dir = dataset / "ImageSets" / "Main"

sets_dir.mkdir(parents=True, exist_ok=True)

images = sorted(images_dir.glob("*.jpg"))

random.seed(42)
random.shuffle(images)

n = len(images)

train_end = int(n * 0.8)
val_end = int(n * 0.9)

train = images[:train_end]
val = images[train_end:val_end]
test = images[val_end:]

def write_list(filename, files):
    with open(sets_dir / filename, "w") as f:
        for img in files:
            f.write(img.stem + "\n")

write_list("train.txt", train)
write_list("val.txt", val)
write_list("test.txt", test)

print("Dataset split completed!")
print("Total:", n)
print("Train:", len(train))
print("Val:", len(val))
print("Test:", len(test))