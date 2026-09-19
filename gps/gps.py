import serial


class GPSLocation:

    def __init__(self, port=None, baudrate=9600):

        self.latitude = 10.38
        self.longitude = 78.82
        self.altitude = 100.0

        self.serial_connection = None

        if port:
            try:
                self.serial_connection = serial.Serial(
                    port,
                    baudrate,
                    timeout=1
                )

                print(f"GPS connected: {port}")

            except Exception as error:
                print(f"GPS hardware not connected: {error}")

    def set_location(self, latitude, longitude, altitude=100.0):

        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude

    def read_gps(self):

        if not self.serial_connection:
            return self.get_location()

        try:

            while self.serial_connection.in_waiting:

                line = self.serial_connection.readline().decode(
                    "ascii",
                    errors="ignore"
                ).strip()

                if line.startswith("$GPGGA"):

                    parts = line.split(",")

                    if len(parts) > 9:

                        lat = self.convert_coordinate(
                            parts[2],
                            parts[3]
                        )

                        lon = self.convert_coordinate(
                            parts[4],
                            parts[5]
                        )

                        altitude = parts[9]

                        if lat is not None:
                            self.latitude = lat

                        if lon is not None:
                            self.longitude = lon

                        if altitude:
                            try:
                                self.altitude = float(altitude)
                            except ValueError:
                                pass

        except Exception as error:

            print(f"GPS read error: {error}")

        return self.get_location()

    def convert_coordinate(self, value, direction):

        if not value:
            return None

        degrees = int(float(value) / 100)

        minutes = float(value) - (degrees * 100)

        coordinate = degrees + (minutes / 60)

        if direction in ["S", "W"]:
            coordinate *= -1

        return round(coordinate, 6)

    def get_location(self):

        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": self.altitude
        }


# Temporary simulation mode
# Later:
# gps = GPSLocation(port="COM3")

gps = GPSLocation()


if __name__ == "__main__":

    print("AquaGuard GPS")
    print("----------------")

    location = gps.read_gps()

    print("Latitude :", location["latitude"])
    print("Longitude:", location["longitude"])
    print("Altitude :", location["altitude"])