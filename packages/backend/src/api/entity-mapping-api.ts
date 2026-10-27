import { isDeepStrictEqual } from "node:util";
import type { EntityMappingRequest } from "@home-assistant-matter-hub/common";
import { entityMappingReferences } from "@home-assistant-matter-hub/common";
import express from "express";
import type { EntityIdentityStorage } from "../services/storage/entity-identity-storage.js";
import type { EntityMappingStorage } from "../services/storage/entity-mapping-storage.js";

export function entityMappingApi(
  mappingStorage: Pick<
    EntityMappingStorage,
    | "getMappingsForBridge"
    | "getMapping"
    | "setMapping"
    | "deleteMapping"
    | "deleteBridgeMappings"
  >,
  identityStorage: Pick<EntityIdentityStorage, "deleteBridgeIdentities">,
): express.Router {
  const router = express.Router();

  router.get("/:bridgeId", (req, res) => {
    const { bridgeId } = req.params;
    const mappings = mappingStorage.getMappingsForBridge(bridgeId);
    res.status(200).json({ bridgeId, mappings });
  });

  router.get("/:bridgeId/:entityId", (req, res) => {
    const { bridgeId, entityId } = req.params;
    const mapping = mappingStorage.getMapping(bridgeId, entityId);
    if (mapping) {
      res.status(200).json(mapping);
    } else {
      res.status(404).json({ error: "Mapping not found" });
    }
  });

  router.put("/:bridgeId/:entityId", async (req, res) => {
    const { bridgeId, entityId } = req.params;
    const body = req.body as Partial<EntityMappingRequest>;
    if (
      "expectedMapping" in body &&
      !isDeepStrictEqual(
        JSON.parse(
          JSON.stringify(mappingStorage.getMapping(bridgeId, entityId) ?? null),
        ),
        body.expectedMapping,
      )
    ) {
      res.status(409).json({
        error:
          "This device mapping changed elsewhere. Reload and review before applying.",
      });
      return;
    }
    if (
      (body.composeDevice !== undefined &&
        typeof body.composeDevice !== "boolean") ||
      (body.composeDevice &&
        (!Array.isArray(body.composedEntities) ||
          body.composedEntities.length === 0 ||
          body.composedEntities.some(
            (part) =>
              !part ||
              typeof part.entityId !== "string" ||
              !part.entityId.trim() ||
              part.entityId === entityId,
          ) ||
          new Set(body.composedEntities.map((part) => part.entityId)).size !==
            body.composedEntities.length))
    ) {
      res.status(400).json({
        error:
          "Explicit composition requires distinct, non-empty sub-entities and a boolean composeDevice.",
      });
      return;
    }
    if (body.onlyIfUnmapped || "expectedMapping" in body) {
      const previous = new Set(
        !body.onlyIfUnmapped && body.expectedMapping
          ? entityMappingReferences(body.expectedMapping)
          : [],
      );
      const proposed = new Set(
        entityMappingReferences({ ...body, entityId }).filter(
          (id) => !previous.has(id),
        ),
      );
      if (
        mappingStorage
          .getMappingsForBridge(bridgeId)
          .some(
            (mapping) =>
              (body.onlyIfUnmapped ||
                !("expectedMapping" in body) ||
                mapping.entityId !== entityId) &&
              entityMappingReferences(mapping).some((id) => proposed.has(id)),
          )
      ) {
        res.status(409).json({
          error:
            "Bundle conflicts with an existing mapping. Reload and review before applying.",
        });
        return;
      }
    }

    const request: EntityMappingRequest = {
      bridgeId,
      entityId,
      matterDeviceType: body.matterDeviceType,
      customName: body.customName,
      customProductName: body.customProductName,
      customVendorName: body.customVendorName,
      customSerialNumber: body.customSerialNumber,
      customVendorId: body.customVendorId,
      disabled: body.disabled,
      filterLifeEntity: body.filterLifeEntity,
      cleaningModeEntity: body.cleaningModeEntity,
      temperatureEntity: body.temperatureEntity,
      humidityEntity: body.humidityEntity,
      pressureEntity: body.pressureEntity,
      batteryEntity: body.batteryEntity,
      faultEntity: body.faultEntity,
      operationalStateEntity: body.operationalStateEntity,
      disableBatteryMapping: body.disableBatteryMapping,
      chargingStateEntity: body.chargingStateEntity,
      roomEntities: body.roomEntities,
      disableLockPin: body.disableLockPin,
      lockWithoutPin: body.lockWithoutPin,
      lockUsercodeService: body.lockUsercodeService,
      lockUsercodeSlot: body.lockUsercodeSlot,
      lockPinMinLength: body.lockPinMinLength,
      lockPinMaxLength: body.lockPinMaxLength,
      powerEntity: body.powerEntity,
      energyEntity: body.energyEntity,
      meterSerialNumber: body.meterSerialNumber,
      pointOfDelivery: body.pointOfDelivery,
      voltageEntity: body.voltageEntity,
      currentEntity: body.currentEntity,
      batteryPowerEntity: body.batteryPowerEntity,
      batteryEnergyEntity: body.batteryEnergyEntity,
      chargingSwitchEntity: body.chargingSwitchEntity,
      currentLimitEntity: body.currentLimitEntity,
      suctionLevelEntity: body.suctionLevelEntity,
      mopIntensityEntity: body.mopIntensityEntity,
      customServiceAreas: body.customServiceAreas,
      customFanSpeedTags: body.customFanSpeedTags,
      fanWindPresets: body.fanWindPresets,
      fanRestoreSpeedOnPowerOn: body.fanRestoreSpeedOnPowerOn,
      currentRoomEntity: body.currentRoomEntity,
      cleanedAreaEntity: body.cleanedAreaEntity,
      vacuumAscendingRoomOrder: body.vacuumAscendingRoomOrder,
      vacuumRoomSwitches: body.vacuumRoomSwitches,
      disableCustomAreaRoomModes: body.disableCustomAreaRoomModes,
      valetudoIdentifier: body.valetudoIdentifier,
      coverSwapOpenClose: body.coverSwapOpenClose,
      coverOpenCloseAsPosition: body.coverOpenCloseAsPosition,
      coverExposeAsDimmableLight: body.coverExposeAsDimmableLight,
      selectExposeAsSwitch: body.selectExposeAsSwitch,
      selectSwitchOnOption: body.selectSwitchOnOption,
      selectSwitchOffOption: body.selectSwitchOffOption,
      coverSliderDebounceMs: body.coverSliderDebounceMs,
      fanSliderDebounceMs: body.fanSliderDebounceMs,
      updateThrottleMs: body.updateThrottleMs,
      disableClimateOnOff: body.disableClimateOnOff,
      disableClimateFanControl: body.disableClimateFanControl,
      climateKeepModeOnIdle: body.climateKeepModeOnIdle,
      climateForceTurnOn: body.climateForceTurnOn,
      climateExposeFan: body.climateExposeFan,
      climateAutoMode: body.climateAutoMode,
      composedEntities: body.composedEntities,
      composeDevice: body.composeDevice,
      disableMomentaryFlip: body.disableMomentaryFlip,
    };

    const config = await mappingStorage.setMapping(request);
    res.status(200).json(config);
  });

  router.delete("/:bridgeId/:entityId", async (req, res) => {
    const { bridgeId, entityId } = req.params;
    await mappingStorage.deleteMapping(bridgeId, entityId);
    res.status(204).send();
  });

  router.delete("/:bridgeId", async (req, res) => {
    const { bridgeId } = req.params;
    await mappingStorage.deleteBridgeMappings(bridgeId);
    // Drop the bridge's frozen identities too, so a re-created bridge with the
    // same id starts fresh instead of inheriting stale anchors (#404).
    await identityStorage.deleteBridgeIdentities(bridgeId);
    res.status(204).send();
  });

  return router;
}
