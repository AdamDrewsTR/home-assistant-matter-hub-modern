import { PowerTopologyServer as Base } from "@matter/main/behaviors";
import { PowerTopology } from "@matter/main/clusters";

// A bridge shares one node, so node scope would attribute one endpoint's power
// to every accessory (#431). Tree scope on a leaf has an empty PartsList, and
// SmartThings then finds no endpoint to attach the meter to (#513). Set scope
// naming the endpoint itself is what SmartThings expects for a metered plug.
export class HaPowerTopologyServer extends Base.with(
  PowerTopology.Feature.SetTopology,
) {
  override async initialize() {
    await super.initialize();
    this.state.availableEndpoints = [this.endpoint.number];
  }
}
