import os
import xml.etree.ElementTree as ET

# Folders
annotations_dir = "dataset/annotations"
labels_dir = "dataset/labels"

# Create labels folder if it doesn't exist
os.makedirs(labels_dir, exist_ok=True)

# Our only class
classes = ["floater"]


def convert_box(size, box):
    width, height = size

    xmin, xmax, ymin, ymax = box

    # YOLO format: center_x, center_y, width, height
    center_x = ((xmin + xmax) / 2) / width
    center_y = ((ymin + ymax) / 2) / height

    box_width = (xmax - xmin) / width
    box_height = (ymax - ymin) / height

    return center_x, center_y, box_width, box_height


# Convert every XML file
for xml_file in os.listdir(annotations_dir):

    if not xml_file.endswith(".xml"):
        continue

    xml_path = os.path.join(annotations_dir, xml_file)

    tree = ET.parse(xml_path)
    root = tree.getroot()

    filename = os.path.splitext(xml_file)[0]
    txt_path = os.path.join(labels_dir, filename + ".txt")

    size = root.find("size")

    width = int(size.find("width").text)
    height = int(size.find("height").text)

    with open(txt_path, "w") as output:

        for obj in root.findall("object"):

            class_name = obj.find("name").text.strip()

            if class_name not in classes:
                continue

            class_id = classes.index(class_name)

            bndbox = obj.find("bndbox")

            xmin = float(bndbox.find("xmin").text)
            xmax = float(bndbox.find("xmax").text)
            ymin = float(bndbox.find("ymin").text)
            ymax = float(bndbox.find("ymax").text)

            x, y, w, h = convert_box(
                (width, height),
                (xmin, xmax, ymin, ymax)
            )

            output.write(
                f"{class_id} {x} {y} {w} {h}\n"
            )

print("XML to YOLO conversion completed!")