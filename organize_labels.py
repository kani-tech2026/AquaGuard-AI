import os
import shutil

base = "dataset/clean"

splits = ["train", "val", "test"]

for split in splits:
    image_dir = os.path.join(base, "images", split)
    label_dir = os.path.join(base, "labels", split)

    os.makedirs(label_dir, exist_ok=True)

    images = [
        f for f in os.listdir(image_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    moved = 0
    missing = 0

    for image in images:
        name = os.path.splitext(image)[0]
        label = name + ".txt"

        source = os.path.join(base, "labels", label)
        destination = os.path.join(label_dir, label)

        if os.path.exists(source):
            shutil.move(source, destination)
            moved += 1
        else:
            missing += 1

    print(f"{split}: images={len(images)}, labels moved={moved}, missing={missing}")