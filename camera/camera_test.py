import cv2

camera = cv2.VideoCapture(0)

if not camera.isOpened():
    print("ERROR: Camera not detected.")
    exit()

print("Camera connected successfully.")
print("Press Q to close.")

while True:
    ret, frame = camera.read()

    if not ret:
        print("ERROR: Failed to read camera.")
        break

    cv2.imshow("AquaGuard - Live Camera", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()
