import { Mixpanel } from 'mixpanel-react-native'

const mixpanel = new Mixpanel('f066dc22ac56e6bea53703c76239504c', true)
let initialized = false

export async function initAnalytics() {
  if (!initialized) {
    await mixpanel.init()
    initialized = true
  }
}

export function track(event: string, properties?: Record<string, any>) {
  mixpanel.track(event, properties)
}
