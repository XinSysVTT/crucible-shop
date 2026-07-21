---

<div align="center">

<h3>☕ Support the Project</h3>

<p>If you want to support this project, you can do so here.</p>

<p><sub>Every coffee helps keep the project maintained and motivates future updates!</sub></p>

<a href="https://buymeacoffee.com/xinsys">
  <img
    src="https://github.com/user-attachments/assets/5c4ef9f4-f6a3-457e-a8d4-34399d545f11"
    alt="Buy Me a Coffee"
    width="180"
  />
</a>

</div>

---

# Crucible Shop

A standalone equipment shop module for the [Crucible](https://foundryvtt.com/packages/crucible) system in Foundry VTT (v14+).

Unlike the Hero Creation wizard's equipment step, this talks to an actor's **real** currency and **real** inventory — meant to be opened on already-created characters at any point in the campaign: a general store, a blacksmith, a black market, whatever the GM wants.

## Features

- **Default shop** — pulls stock from the system's own Equipment compendium tree.
- **Custom shops** — GMs create any number of shops, stocked by dragging in Items from the world, a compendium, or an actor sheet. Prices can be overridden per item.
- **Randomize Items** — quickly stock a custom shop with randomly generated loot within a price range, item type, and quality.
- **Cart-based purchasing** — players stage purchases and only spend currency / receive items on confirm; nothing changes until then.
- **Chat invitations** — GMs post a clickable "open shop" button publicly or as a whisper to specific players. No sockets required; each player opens the shop locally on their own client.

## Usage

- **GMs**: open the shop manager from the Items directory (store icon) or via `Settings > Crucible Shop`. Select/create a shop, set its mode (Default/Custom), and invite players.
- **Players**: click the "Open Shop" button in chat, or run `crucibleShop.open()` from the console/a macro.
- **Macro API**: `game.modules.get("crucible-shop").api` exposes `openShop`, `inviteToShop`, `getShops`, `getShop`, `saveShop`, and `deleteShop`.

## Requirements

- Foundry VTT v14+
- The [Crucible](https://foundryvtt.com/packages/crucible) game system

## Installation

Install via the module manifest URL, or place this folder in your Foundry `Data/modules/` directory and enable it in a Crucible-system world.

## Known limitations

- Randomized items require Crucible's `CrucibleItem.randomize` API, so at least one eligible base item must exist for the chosen price range / item type / quality — an overly narrow combination will show an error explaining why nothing matched.
