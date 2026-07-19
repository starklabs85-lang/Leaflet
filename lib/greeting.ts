export function getGreetingForHour(hour: number) {
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function getGreeting() {
  return getGreetingForHour(new Date().getHours());
}
