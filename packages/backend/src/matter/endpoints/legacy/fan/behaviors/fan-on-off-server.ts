import {
  OnOffServer,
  PlugOnOffServer,
} from "../../../../behaviors/on-off-server.js";

const fanOnOff = {
  turnOn: () => ({ action: "fan.turn_on" }),
  turnOff: () => ({ action: "fan.turn_off" }),
};

export const FanOnOffServer = OnOffServer(fanOnOff);

// For the on/off only fan exposed as a plug.
export const FanPlugOnOffServer = PlugOnOffServer(fanOnOff);
