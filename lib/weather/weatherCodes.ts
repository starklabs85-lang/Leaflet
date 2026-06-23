// WMO weather code → display label + MaterialCommunityIcons name.

type WeatherCodeDisplay = {
  label: string;
  icon:
    | "weather-sunny"
    | "weather-partly-cloudy"
    | "weather-cloudy"
    | "weather-fog"
    | "weather-rainy"
    | "weather-pouring"
    | "weather-snowy"
    | "weather-lightning-rainy";
};

export function describeWeatherCode(code: number): WeatherCodeDisplay {
  if (code === 0) {
    return { label: "Clear", icon: "weather-sunny" };
  }

  if (code === 1 || code === 2) {
    return { label: "Partly cloudy", icon: "weather-partly-cloudy" };
  }

  if (code === 3) {
    return { label: "Overcast", icon: "weather-cloudy" };
  }

  if (code === 45 || code === 48) {
    return { label: "Foggy", icon: "weather-fog" };
  }

  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67)) {
    return { label: "Rain", icon: "weather-rainy" };
  }

  if (code >= 71 && code <= 77) {
    return { label: "Snow", icon: "weather-snowy" };
  }

  if (code >= 80 && code <= 82) {
    return { label: "Showers", icon: "weather-pouring" };
  }

  if (code >= 85 && code <= 86) {
    return { label: "Snow showers", icon: "weather-snowy" };
  }

  if (code >= 95) {
    return { label: "Thunderstorm", icon: "weather-lightning-rainy" };
  }

  return { label: "Mixed conditions", icon: "weather-partly-cloudy" };
}
