import type { EndpointType } from "@matter/main";
import { OnOffPlugInUnitDevice } from "@matter/main/devices";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PlugOnOffServer } from "../../../behaviors/on-off-server.js";

const RemoteOnOffServer = PlugOnOffServer({
  turnOn: () => ({
    action: "remote.turn_on",
  }),
  turnOff: () => ({
    action: "remote.turn_off",
  }),
});

const RemoteEndpointType = OnOffPlugInUnitDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  RemoteOnOffServer,
);

export function RemoteDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  return RemoteEndpointType.set({ homeAssistantEntity });
}
