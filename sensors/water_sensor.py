import random


class WaterSensor:
    def __init__(self):
        self.turbidity = 0.0
        self.temperature = 0.0
        self.ph = 7.0

    def read(self):
        # Temporary simulation values
        self.turbidity = round(random.uniform(5, 80), 2)
        self.temperature = round(random.uniform(24, 34), 2)
        self.ph = round(random.uniform(6.5, 8.5), 2)

        return {
            "turbidity_ntu": self.turbidity,
            "temperature_c": self.temperature,
            "ph": self.ph
        }


water_sensor = WaterSensor()


if __name__ == "__main__":
    print("AquaGuard Water Sensor")
    print("----------------------")

    data = water_sensor.read()

    print("Turbidity :", data["turbidity_ntu"], "NTU")
    print("Temperature:", data["temperature_c"], "°C")
    print("pH         :", data["ph"])