---
title: Sharing devices
---

# Sharing devices and following locations

Matter Hub Modern offers two sharing modes. You choose the mode for each hub; existing hubs are not converted automatically.

| Mode | Best for | Future additions |
| --- | --- | --- |
| **Choose devices** | A precise, fixed selection | Not shared until you select them |
| **Follow rooms or floors** | Keeping an assistant in step with part of your home | Eligible devices and entities are added automatically |

## Follow a room or floor

1. Open your hub's **Devices** tab, or the **Choose devices** step when creating a hub.
2. Select **Follow rooms or floors**.
3. Choose rooms, floors, or a mixture. Selecting a floor follows its Home Assistant membership, including rooms added to that floor later.
4. Optionally open **Customize what is shared** to leave out whole devices or individual entities, or include diagnostic/configuration entities.
5. Review the current additions and removals, then explicitly approve and apply the change. New hubs show the automatic-sharing warning in their final review.

For example, following **Upstairs** shares eligible devices assigned to upstairs rooms. A new light added to an upstairs room joins automatically. Moving that light downstairs removes it from this hub. Selecting the upstairs floor does not create one hub per room.

The hub checks registry changes on its configured Home Assistant refresh interval; changes are not necessarily immediate. A failed registry request retains the previous location snapshot instead of treating every room as deleted. Actual entity deletion also uses the engine's existing removal safeguards. Temporary `unavailable` or `unknown` state is not a request to unshare a device.

## What belongs to a location?

A physical device follows its **device-level room assignment in Home Assistant**. All its eligible entities follow together, even if a sensor has an individual room override. If its device has no assigned room, each entity falls back to its own room. Standalone entities also follow their own room.

Location sharing always excludes hidden and disabled entities. Diagnostic and configuration entities are excluded unless you opt in. Matching the sharing rule does not guarantee a supported Matter endpoint: entity type, mapping settings, and assistant support still apply. The preview counts matching entities, not Matter endpoints.

**Whole-device selection is not automatic Matter composition.** Existing bundle and companion settings still determine which readings and controls share an endpoint. Location exclusions also apply to companion lookup, so an excluded entity cannot be reintroduced through automatic companion mapping.

## Exceptions that stay out

**Devices to leave out** excludes the physical device by its Home Assistant device ID, including eligible entities added to that device in the future. **Individual entities to leave out** affects only those entity IDs. Exceptions remain saved if a device moves out of scope and returns. If Home Assistant deletes and recreates an entity or device with a new ID, it is a different item and its old exception will not apply.

Missing locations and exclusions are retained rather than silently discarded. A deleted room shares nothing; remove its chip to stop following its ID. Assign unassigned devices to rooms in Home Assistant if you want all of their entities to follow one location.

## Understand automatic changes

Approving location sharing also authorizes future eligible additions and removals in those locations. Newly added controls become available to the assistant paired with that hub without another approval. Removing or moving a device can affect assistant routines. This feature does not move rooms or routines inside Alexa, Apple Home, or another controller.

To stop automatic enrollment, select **Choose devices**, review the currently matching entities as a fixed selection, and apply. Custom sharing rules can still be managed under **Advanced**; converting them is explicit and reviewed.

## Updates and backups

Location rules and exceptions are stored with the hub configuration and included in configuration backups and exports. Keep a backup before changing sharing modes. Do not downgrade a location-sharing hub to a build without location-rule support: older builds cannot enforce the location scope. This feature requires a release containing location sharing; older installed builds do not gain it from a browser refresh.
