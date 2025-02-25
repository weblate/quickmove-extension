/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch */

import { RootNode } from "../common/foldernode.js";
import { DEFAULT_PREFERENCES, getValidatedDefaultFolders } from "../common/util.js";

async function restore_options() {
  let prefs = await browser.storage.local.get(DEFAULT_PREFERENCES);

  for (let key of Object.keys(prefs)) {
    let elem = document.getElementById(key);
    if (!elem) {
      continue;
    }

    if (!elem.type && elem.dataset.type == "radio") {
      let item = document.querySelector(`input[type='radio'][name='${key}'][value='${prefs[key]}']`);
      item.checked = true;
    } else if (elem.type == "checkbox") {
      elem.checked = prefs[key];
    } else {
      elem.value = prefs[key];
    }
  }
}

function change_options(event) {
  let node = event.target;
  let defaultPrefs = Object.keys(DEFAULT_PREFERENCES);
  let isPreference = defaultPrefs.includes(node.id) || defaultPrefs.includes(node.name);
  if (!node.id || (node.localName != "select" && node.localName != "input") || !isPreference) {
    return;
  }

  if (node.getAttribute("type") == "checkbox") {
    browser.storage.local.set({ [node.id]: node.checked });
  } else if (node.getAttribute("type") == "number") {
    browser.storage.local.set({ [node.id]: parseInt(node.value, 10) });
  } else if (node.getAttribute("type") == "text" || node.localName == "select") {
    browser.storage.local.set({ [node.id]: node.value });
  } else if (node.getAttribute("type") == "radio") {
    browser.storage.local.set({ [node.name]: node.value });
  }

  if (node.id == "useLegacyShortcuts") {
    browser.runtime.sendMessage({ action: "setupShortcuts", enable: node.checked });
  }
}

async function setup_listeners() {
  let fontSize = await messenger.quickmove.getUIFontSize();
  window.document.documentElement.style.setProperty("font-size", `${fontSize}px`);

  document.body.addEventListener("change", change_options);

  document.getElementById("onboarding").addEventListener("click", () => {
    browser.tabs.create({ url: "/onboarding/onboarding.html" });
  });
}

function setup_localization() {
  for (let node of document.querySelectorAll("[data-l10n-id]")) {
    let l10nid = node.getAttribute("data-l10n-id");
    node.textContent = browser.i18n.getMessage(l10nid) || l10nid;

    // Set the title attribute
    if (node.localName == "label") {
      node = node.parentNode;
    }
    node.title = browser.i18n.getMessage(l10nid + ".title");
  }
}

async function setup_defaultfolders() {
  let { skipArchive } = await browser.storage.local.get({ skipArchive: DEFAULT_PREFERENCES.skipArchive });
  let accounts = await browser.accounts.list(true);
  let rootNode = new RootNode(accounts, skipArchive);

  let folderPicker = document.getElementById("folder-picker");
  folderPicker.initItems(rootNode.folderNodes, []);

  let defaultFolders = await getValidatedDefaultFolders(rootNode);

  let defaultFolderList = document.getElementById("default-folders");
  defaultFolderList.initItems(defaultFolders, null, true);

  let defaultFolderSet = new Set(defaultFolders);

  folderPicker.addEventListener("item-selected", (event) => {
    let newNode = rootNode.findFolder(event.detail);

    defaultFolderSet.add(newNode);
    let allItems = [...defaultFolderSet];

    defaultFolderList.allItems = allItems;
    defaultFolderList.repopulate();
    folderPicker.searchValue = "";

    let storageData = allItems.map(item => ({ accountId: item.accountId, path: item.path }));
    browser.storage.local.set({ defaultFolders: storageData });
  });

  defaultFolderList.addEventListener("item-deleted", (event) => {
    let oldNode = rootNode.findFolder(event.detail);

    defaultFolderSet.delete(oldNode);
    let allItems = [...defaultFolderSet];

    defaultFolderList.allItems = allItems;
    defaultFolderList.repopulate();

    let storageData = allItems.map(item => ({ accountId: item.accountId, path: item.path }));
    browser.storage.local.set({ defaultFolders: storageData });
  });

  document.getElementById("skipArchive").addEventListener("change", async (event) => {
    rootNode.skipArchive = event.target.checked;
    rootNode.reindex();
  });

  document.getElementById("defaultFolderSetting").addEventListener("change", (event) => {
    document.querySelector(".panel.selected")?.classList.remove("selected");
    document.querySelector(`.panel[data-value="${event.target.value}"]`).classList.add("selected");
  });

  let currentValue = document.querySelector("#defaultFolderSetting input:checked")?.value;
  if (currentValue) {
    document.querySelector(`.panel[data-value="${currentValue}"]`).classList.add("selected");
  }
}

document.addEventListener("DOMContentLoaded", setup_localization, { once: true });
document.addEventListener("DOMContentLoaded", setup_listeners, { once: true });
document.addEventListener("DOMContentLoaded", restore_options, { once: true });
document.addEventListener("DOMContentLoaded", setup_defaultfolders, { once: true });
