import type { Messages } from "../zh";

export const callTime: Messages["callTime"] = {
  callTimeDial: {
    countdown: "Countdown",
  },
  callTimeFloat: {
    callTimeIsUpBackTo: "Call Time is up. Back to the countdown",
    callTimeSLeftBackTo: (a) => `Call Time: ${a}s left. Back to the countdown`,
  },
  callTimeScreen: {
    lengthInSecondsTapToType: "Length in seconds. Tap to type",
    fromToSeconds: (a, b) => `From ${a} to ${b} seconds`,
    secondsUnit: "s",
    secondsLabelled: (a, b) => `${a} ${b} s`,
    more: "More",
    less: "Less",
    sLeft: (a) => `${a}s left`,
    timesUp: "Time’s up",
    shrinkToAFloatingTimer: "Shrink to a floating timer",
    start: "Start",
    stop: "Stop",
    exit: "Exit",
  },
};
