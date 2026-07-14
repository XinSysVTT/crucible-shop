import {MODULE_ID, getShops, saveShop, deleteShop, inviteToShop, openShop} from "./crucible-shop.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * A GM-facing application for creating and curating shops.
 *
 * - The built-in "default" shop always exists, always pulls from the system's Equipment
 *   compendium tree, and cannot be deleted or switched to custom mode.
 * - Additional shops can be created in either mode:
 *     - "default" mode: also pulls from the Equipment compendium tree (useful for a second
 *       general store with a different name/flavor).
 *     - "custom" mode: stocked entirely by hand, by dragging Items onto the drop zone from the
 *       world, a compendium, or an actor sheet.
 * - From here the GM can also invite players to a shop, either as a public chat card or as a
 *   whisper to specific selected players.
 */
export class CrucibleShopManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "crucible-shop-manager",
    tag: "div",
    classes: ["crucible", "themed", "theme-dark", "crucible-shop-manager"],
    window: {
      title: "CRUCIBLE_SHOP.ManagerTitle",
      icon: "fa-solid fa-coins",
      resizable: true
    },
    position: {
      width: 760,
      height: 640
    },
    actions: {
      createShop: CrucibleShopManagerApp.#onCreateShop,
      selectShop: CrucibleShopManagerApp.#onSelectShop,
      deleteShop: CrucibleShopManagerApp.#onDeleteShop,
      removeItem: CrucibleShopManagerApp.#onRemoveItem,
      invitePublic: CrucibleShopManagerApp.#onInvitePublic,
      inviteWhisper: CrucibleShopManagerApp.#onInviteWhisper,
      openShop: CrucibleShopManagerApp.#onOpenShop
    }
  };

  /** @override */
  static PARTS = {
    manager: {
      id: "manager",
      template: "modules/crucible-shop/templates/shop-manager.hbs",
      scrollable: [".shop-list-panel", ".shop-detail-panel"]
    }
  };

  /**
   * Which shop is currently selected in the left-hand list.
   * @type {{selectedShopId: string}}
   */
  _state = {selectedShopId: "default"};

  /* -------------------------------------------- */
  /*  Rendering                                    */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const shops = getShops();
    const shopList = Object.values(shops).sort((a, b) => a.name.localeCompare(b.name));
    let selected = shops[this._state.selectedShopId];
    if ( !selected ) {
      selected = shopList[0] ?? null;
      if ( selected ) this._state.selectedShopId = selected.id;
    }

    let items = [];
    if ( selected?.mode === "custom" ) {
      items = await Promise.all((selected.itemUuids ?? []).map(async uuid => {
        const item = await fromUuid(uuid);
        if ( !item ) return {uuid, name: game.i18n.localize("CRUCIBLE_SHOP.MissingItem"), img: "icons/svg/hazard.svg", price: 0, missing: true};
        return {uuid, name: item.name, img: item.img, price: item.system?.price ?? 0};
      }));
    }

    const users = game.users.filter(u => !u.isGM).map(u => ({id: u.id, name: u.name, active: u.active}));

    return {
      shops: shopList.map(s => ({...s, active: s.id === this._state.selectedShopId})),
      selected,
      isDefaultShop: selected?.id === "default",
      items,
      users,
      noUsers: !users.length
    };
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const dropzone = this.element.querySelector(".shop-item-drop");
    if ( dropzone ) {
      dropzone.addEventListener("dragover", event => event.preventDefault());
      dropzone.addEventListener("drop", this.#onDropItem.bind(this));
    }

    const nameInput = this.element.querySelector(".shop-name-input");
    nameInput?.addEventListener("change", this.#onChangeName.bind(this));

    const modeSelect = this.element.querySelector(".shop-mode-select");
    modeSelect?.addEventListener("change", this.#onChangeMode.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Handlers                               */
  /* -------------------------------------------- */

  /**
   * Handle an Item being dropped onto the custom item drop zone.
   * @param {DragEvent} event
   */
  async #onDropItem(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch(err) {
      return;
    }
    if ( data?.type !== "Item" ) return;

    const item = await Item.implementation.fromDropData(data);
    if ( !item ) return;

    const shops = getShops();
    const shop = shops[this._state.selectedShopId];
    if ( !shop || (shop.mode !== "custom") ) {
      ui.notifications.warn(game.i18n.localize("CRUCIBLE_SHOP.SelectCustomFirst"));
      return;
    }

    shop.itemUuids ??= [];
    if ( !shop.itemUuids.includes(item.uuid) ) shop.itemUuids.push(item.uuid);
    await saveShop(shop);
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  async #onChangeName(event) {
    const shops = getShops();
    const shop = shops[this._state.selectedShopId];
    if ( !shop ) return;
    shop.name = event.target.value.trim() || shop.name;
    await saveShop(shop);
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  async #onChangeMode(event) {
    const shops = getShops();
    const shop = shops[this._state.selectedShopId];
    if ( !shop || (shop.id === "default") ) return;
    shop.mode = event.target.value;
    shop.itemUuids ??= [];
    await saveShop(shop);
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  static async #onCreateShop() {
    const id = foundry.utils.randomID();
    const shop = {id, name: game.i18n.localize("CRUCIBLE_SHOP.NewShop"), mode: "custom", itemUuids: []};
    await saveShop(shop);
    this._state.selectedShopId = id;
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  static async #onSelectShop(_event, target) {
    this._state.selectedShopId = target.closest("[data-shop-id]").dataset.shopId;
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  static async #onDeleteShop(event, target) {
    event.stopPropagation();
    const shopId = target.closest("[data-shop-id]").dataset.shopId;
    if ( shopId === "default" ) {
      ui.notifications.warn(game.i18n.localize("CRUCIBLE_SHOP.CannotDeleteDefault"));
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("CRUCIBLE_SHOP.DeleteShop")},
      content: `<p>${game.i18n.localize("CRUCIBLE_SHOP.DeleteShopConfirm")}</p>`
    });
    if ( !confirmed ) return;
    await deleteShop(shopId);
    if ( this._state.selectedShopId === shopId ) this._state.selectedShopId = "default";
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  static async #onRemoveItem(_event, target) {
    const uuid = target.closest("[data-uuid]").dataset.uuid;
    const shops = getShops();
    const shop = shops[this._state.selectedShopId];
    if ( !shop ) return;
    shop.itemUuids = (shop.itemUuids ?? []).filter(u => u !== uuid);
    await saveShop(shop);
    await this.render({parts: ["manager"]});
  }

  /* -------------------------------------------- */

  static async #onInvitePublic() {
    await inviteToShop(this._state.selectedShopId, []);
  }

  /* -------------------------------------------- */

  static async #onInviteWhisper() {
    const checked = this.element.querySelectorAll('input[name="inviteUser"]:checked');
    const userIds = Array.from(checked).map(el => el.value);
    if ( !userIds.length ) {
      ui.notifications.warn(game.i18n.localize("CRUCIBLE_SHOP.SelectPlayersFirst"));
      return;
    }
    await inviteToShop(this._state.selectedShopId, userIds);
  }

  /* -------------------------------------------- */

  static async #onOpenShop() {
    const shopId = this._state.selectedShopId;
    const actor = (game.user.character?.isOwner ? game.user.character : null)
      ?? game.actors.find(a => (a.type === "hero") && a.isOwner);
    if ( !actor ) {
      ui.notifications.warn(game.i18n.localize("CRUCIBLE_SHOP.NoActor"));
      return;
    }
    await openShop(actor, shopId);
  }
}
