import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_ROUTE_KEY = "finishing-platform-pending-route";

export async function savePendingRoute(route: string) {
  await AsyncStorage.setItem(PENDING_ROUTE_KEY, route);
}

export async function consumePendingRoute() {
  const route = await AsyncStorage.getItem(PENDING_ROUTE_KEY);
  await AsyncStorage.removeItem(PENDING_ROUTE_KEY);
  return route;
}
