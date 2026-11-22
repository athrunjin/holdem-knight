/** The Call Time countdown. */
export const callTime = {
  callTimeDial: {
    countdown: "倒计时",
  },
  callTimeFloat: {
    callTimeIsUpBackTo: "Call Time 时间到，回到倒计时",
    callTimeSLeftBackTo: (a: string | number) => `Call Time 剩余 ${a} 秒，回到倒计时`,
  },
  callTimeScreen: {
    lengthInSecondsTapToType: "时长（秒），点按后输入",
    fromToSeconds: (a: string | number, b: string | number) => `范围 ${a}–${b} 秒`,
    secondsUnit: "秒",
    secondsLabelled: (a: string | number, b: string | number) => `${a} ${b} 秒`,
    more: "增加",
    less: "减少",
    sLeft: (a: string | number) => `剩余 ${a} 秒`,
    timesUp: "时间到",
    shrinkToAFloatingTimer: "缩小成悬浮窗",
    start: "开始",
    stop: "结束",
    exit: "退出",
  },
};
