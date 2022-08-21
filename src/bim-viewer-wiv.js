import canada from "../static/data/canada.js";
import { Color, LineBasicMaterial, MeshBasicMaterial } from "three";
import { IfcViewerAPI } from "web-ifc-viewer";

import {
  closeNavBar,
  selectedButton,
  toggleVisibility,
  hoverHighlihgtMateral,
  pickHighlihgtMateral,
  labeling,
  createOptions,
  sortChildren,
} from "../modules/cims-dt-api"

import {
  IFCWALL,
  IFCWALLSTANDARDCASE,
  IFCSLAB,
  IFCWINDOW,
  IFCMEMBER,
  IFCPLATE,
  IFCCURTAINWALL,
  IFCDOOR,
  IFCROOF,
} from "web-ifc";

import Stats from "stats.js/src/Stats";

// Get the URL parameter
const currentURL = window.location.href;
const url = new URL(currentURL);
const currentModelCode = url.searchParams.get("id");
let codes = currentModelCode.split("/");
let province = {term: codes[0]};
let city = {name: codes[1]};
let site = {id: codes[2]};
let building = {id:codes[3]};
const toggle = {};

// Get user
let currentUser = "";
document
  .getElementById("user")
  .addEventListener(
    "change",
    () => (currentUser = document.getElementById("user").value)
  );

site = canada.provinces[province.term].cities[city.name].sites[site.id];
let buildings = site.buildings;
building.name = buildings[building.id].name;
const buildingSelector = document.getElementById("building-select");
createOptions(buildingSelector, buildings);

document
  .getElementById("building-select")
  .addEventListener("change", function () {
    let selectedOption = this[this.selectedIndex].id;
    let previosBuildingId = currentURL.split('/').slice(-1)[0];
    let len = -previosBuildingId.length
    let newURL = currentURL.slice(0, len) + selectedOption
    location.href = newURL;
  });
closeNavBar();

const container = document.getElementById("viewer-container");

// Layers 🍰
const layerButton = document.getElementById("layers");
let layersToggle = true;
layerButton.onclick = () => {
  layersToggle = !layersToggle;
  selectedButton(layerButton, layersToggle);
  layersToggle ?
  document.getElementById('toolbar').classList.remove('hidden') :
  document.getElementById('toolbar').classList.add('hidden')
};

// IFC Viewer 👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️👁️
const viewer = new IfcViewerAPI({
  container,
  backgroundColor: new Color(0xdddddd),
});
viewer.IFC.setWasmPath("../src/wasm/");
const scene = viewer.context.getScene();
// Create axes
viewer.axes.setAxes();

// Set up stats
const stats = new Stats();
stats.showPanel(0);
// document.body.append(stats.dom);
stats.dom.style.right = "5px";
stats.dom.style.bottom = "5px";

stats.dom.style.left = "auto";
viewer.context.stats = stats;

viewer.IFC.loader.ifcManager.applyWebIfcConfig({
  USE_FAST_BOOLS: true,
  COORDINATE_TO_ORIGIN: true,
});

let ifcURL = `${site.ifcPath}${site.buildings[building.id].ifcFileName}`;
building.ifcURL = ifcURL
let model;

loadIfc(ifcURL);

// Projection
document.getElementById("projection").onclick = () =>
  viewer.context.ifcCamera.toggleProjection();

// Load buildings 🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️

let properties;
let projectTree;
const plansContainer = document.getElementById("plans-menu");
async function loadIfc(ifcURL) {
  const loadingContainer = document.getElementById("loading-container");
  const progressText = document.getElementById("progress-text");

  model = await viewer.IFC.loadIfcUrl(
    ifcURL,
    true,
    (progress) => {
      loadingContainer.style.display = "flex";
      progressText.textContent = `Loading ${building.name}: ${Math.round((progress.loaded * 100) / progress.total)}%`;
    },
    (error) => {
      return
    }
  );

  const rawProperties = await fetch( `${site.jsonPropertiesPath}${building.id}_properties.json`);
  properties = await rawProperties.json();

  // Get project tree 🌳
  projectTree = await constructSpatialTree();
  createTreeMenu(projectTree);

  // Floor plans 👣👣👣👣👣
  const plansButton = document.getElementById("plans");
  toggle.plans = false;
  const plansMenu = document.getElementById("plans-menu");
  toggleVisibility(plansButton, toggle.plans, plansMenu);

  // Toggle left menu ⬅️
  document.getElementById("toolbar").onclick = () => {
    let plans = !document
      .getElementById("plans-menu")
      .classList.contains("hidden");
    let ifc = !document
      .getElementById("ifc-tree-menu")
      .classList.contains("hidden");
    toggle.left = plans || ifc;
    toggle.left
      ? document.getElementById("left-menu").classList.remove("hidden")
      : document.getElementById("left-menu").classList.add("hidden");
  };

  await viewer.plans.computeAllPlanViews(model.modelID);

  const lineMaterial = new LineBasicMaterial({ color: "black" });
  const baseMaterial = new MeshBasicMaterial({
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  await viewer.edges.create(
    "plan-edges",
    model.modelID,
    lineMaterial,
    baseMaterial
  );

  // Floor plan viewing
  const allPlans = viewer.plans.getAll(model.modelID);

  for (const plan of allPlans) {
    const currentPlan = viewer.plans.planLists[model.modelID][plan];
      const planButton = document.createElement("button");
      planButton.classList.add("levels");
      plansContainer.appendChild(planButton);
      planButton.textContent = currentPlan.name;
      planButton.onclick = () => {
        viewer.plans.goTo(model.modelID, plan, true);
        viewer.edges.toggle("plan-edges", true);
        togglePostproduction(false);
        toggleShadow(false);
      };
  }

    viewer.shadowDropper.renderShadow(model.modelID);
  viewer.context.renderer.postProduction.active = true;
  loadingContainer.style.display = "none";
  }
    const button = document.createElement("button");
    plansContainer.appendChild(button);
    button.classList.add("button");
    button.textContent = "Exit Level View";
    button.onclick = () => {
      viewer.plans.exitPlanView();
      viewer.edges.toggle("plan-edges", false);
      togglePostproduction(true);
      toggleShadow(true);
    };

// Hover → Highlight
viewer.IFC.selector.preselection.material = hoverHighlihgtMateral;
window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

// Dimensions 📏📏📏📏📏📏📏📏📏📏📏📏📏📏📏📏📏
const dimensionsButton = document.getElementById("dimensions");
toggle.dimensions = false;
let clicked = 0;
dimensionsButton.onclick = () => {
  toggle.dimensions = !toggle.dimensions;
  viewer.dimensions.active = toggle.dimensions;
  viewer.dimensions.previewActive = toggle.dimensions;
  let visibility = toggle.dimensions ? "Hide" : "Show";
  let button = document.getElementById("dimensions");
  button.setAttribute("title", `${visibility} ${button.id}`);
  toggle.dimensions
    ? button.classList.add("selected-button")
    : button.classList.remove("selected-button");
  clicked = 0;
};

// Clipping planes
const clippingButton = document.getElementById("clipping");
toggle.clipping = false;
clippingButton.onclick = () => {
  toggle.clipping = !toggle.clipping;
  viewer.clipper.active = toggle.clipping;
  let visibility = toggle.clipping ? "Hide" : "Show";
  let button = document.getElementById("clipping");
  button.setAttribute("title", `${visibility} ${button.id}`);
  selectedButton(button, toggle.clipping)
};

// Click → Dimensions
window.onclick = () => {
  if (clicked > 0 && toggle.dimensions) {
    viewer.dimensions.create();
  }
  clicked++;
};

// Keybord ⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️⌨️
window.onkeydown = (event) => {
  const keyName = event.key;
  if (keyName === "e") {
    console.log('export:', building)
    preposcessIfc(building)
  }
  if (event.code === "Escape") {
    viewer.IFC.selector.unpickIfcItems();
    viewer.IFC.selector.unHighlightIfcItems();
  }
  if (event.code === "Space") {
    viewer.context.fitToFrame();
  }

  if (event.code === "Delete" && toggle.dimensions) {
    viewer.dimensions.delete();
  }
  if (event.code === "Delete" && toggle.clipping) {
    viewer.clipper.deletePlane();
  }
};

// Properties 📃📃📃📃📃📃📃📃📃📃📃📃📃📃📃📃📃📃📃
const propsGUI = document.getElementById("ifc-property-menu-root");
const propButton = document.getElementById("properties");
toggle.proprerties = false;
const propertyMenu = document.getElementById("ifc-property-menu");
toggleVisibility(propButton, toggle.proprerties, propertyMenu);

// Pick → propterties
viewer.IFC.selector.selection.material = pickHighlihgtMateral;

window.ondblclick = async () => {
  const result = await viewer.IFC.selector.pickIfcItem(false);
    // Clipping Planes ✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️✂️
  if (toggle.clipping) {
    viewer.clipper.createPlane();
    return
  }
  if (result) {
    const foundProperties = properties[result.id];
    const psets = getPropertySets(foundProperties);
    createPropsMenu(psets);
  }
};

// Utils functions
function getFirstItemOfType(type) {
  return Object.values(properties).find((item) => item.type === type);
}

function getAllItemsOfType(type) {
  return Object.values(properties).filter((item) => item.type === type);
}

// Get spatial tree
async function constructSpatialTree() {
  const ifcProject = getFirstItemOfType("IFCPROJECT");

  const ifcProjectNode = {
    expressID: ifcProject.expressID,
    type: "IFCPROJECT",
    children: [],
  };

  const relContained = getAllItemsOfType("IFCRELAGGREGATES");
  const relSpatial = getAllItemsOfType("IFCRELCONTAINEDINSPATIALSTRUCTURE");

  await constructSpatialTreeNode(ifcProjectNode, relContained, relSpatial);

  return ifcProjectNode;
}

// Recursively constructs the spatial tree
async function constructSpatialTreeNode(item, contains, spatials) {
  const spatialRels = spatials.filter(
    (rel) => rel.RelatingStructure === item.expressID
  );
  const containsRels = contains.filter(
    (rel) => rel.RelatingObject === item.expressID
  );

  const spatialRelsIDs = [];
  spatialRels.forEach((rel) => spatialRelsIDs.push(...rel.RelatedElements));

  const containsRelsIDs = [];
  containsRels.forEach((rel) => containsRelsIDs.push(...rel.RelatedObjects));

  const childrenIDs = [...spatialRelsIDs, ...containsRelsIDs];

  const children = [];
  for (let i = 0; i < childrenIDs.length; i++) {
    const childID = childrenIDs[i];
    const props = properties[childID];
    const child = {
      expressID: props.expressID,
      type: props.type,
      children: [],
    };

    await constructSpatialTreeNode(child, contains, spatials);
    children.push(child);
  }

  item.children = children;
}

// Gets the property sets

function getPropertySets(props) {
  const id = props.expressID;
  const propertyValues = Object.values(properties);
  const allPsetsRels = propertyValues.filter(
    (item) => item.type === "IFCRELDEFINESBYPROPERTIES"
  );
  const relatedPsetsRels = allPsetsRels.filter((item) =>
    item.RelatedObjects.includes(id)
  );
  const psets = relatedPsetsRels.map(
    (item) => properties[item.RelatingPropertyDefinition]
  );
  for (let pset of psets) {
    pset.HasProperty = pset.HasProperties.map((id) => properties[id]);
  }
  props.psets = psets;
  return props;
}

function createPropsMenu(props) {
  removeAllChildren(propsGUI);

  const psets = props.psets;
  const mats = props.mats;
  const type = props.type;

  delete props.psets;
  delete props.mats;
  delete props.type;

  for (let key in props) {
    createPropertyEntry(key, props[key]);
  }
}

function createPropertyEntry(key, value) {
  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  if (value === null || value === undefined) value = "undefined";
  else if (value.value) value = value.value;

  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);

  propsGUI.appendChild(propContainer);
}

// Project Tree 🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳

const toggler = document.getElementsByClassName("caret");
let i;

for (i = 0; i < toggler.length; i++) {
  toggler[i].addEventListener("click", function () {
    this.parentElement.querySelector(".nested").classList.toggle("active");
    this.classList.toggle("caret-down");
  });
}

const treeButton = document.getElementById("project-tree");
toggle.tree = false;
const treeMenu = document.getElementById("ifc-tree-menu");
toggleVisibility(treeButton, toggle.tree, treeMenu);

function createTreeMenu(ifcProject) {
  const root = document.getElementById("tree-root");
  removeAllChildren(root);
  const ifcProjectNode = createNestedChild(root, ifcProject);
  for (const child of ifcProject.children) {
    constructTreeMenuNode(ifcProjectNode, child);
  }
}

function constructTreeMenuNode(parent, node) {
  const children = node.children;
  if (children.length === 0) {
    createSimpleChild(parent, node);
    return;
  }
  const nodeElement = createNestedChild(parent, node);
  for (const child of children) {
    constructTreeMenuNode(nodeElement, child);
  }
}

function createSimpleChild(parent, node) {
  const content = nodeToString(node);
  const childNode = document.createElement("li");
  childNode.classList.add("leaf-node");
  childNode.textContent = content;
  parent.appendChild(childNode);

  childNode.onclick = async () => {
    viewer.IFC.selector.pickIfcItemsByID(0, [node.expressID]);
  };
}

function createNestedChild(parent, node) {
  const content = nodeToString(node);
  const root = document.createElement("li");
  createTitle(root, content);
  const childrenContainer = document.createElement("ul");
  childrenContainer.classList.add("nested");
  root.appendChild(childrenContainer);
  parent.appendChild(root);
  return childrenContainer;
}

function createTitle(parent, content) {
  const title = document.createElement("span");
  title.classList.add("caret");
  title.onclick = () => {
    title.parentElement.querySelector(".nested").classList.toggle("active");
    title.classList.toggle("caret-down");
  };

  title.textContent = content;
  parent.appendChild(title);
}

function nodeToString(node) {
  return `${node.type} - ${node.expressID}`;
}

function removeAllChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

// Labeling 💬💬💬💬💬💬💬💬💬💬💬💬💬💬💬💬💬💬💬
window.oncontextmenu = () => {
  const collision = viewer.context.castRayIfc(model);
  if (collision === null || currentUser === "") return;
  const collisionLocation = collision.point;
  labeling(scene, collisionLocation, currentUser);
};

function toggleShadow(active) {
  const shadows = Object.values(viewer.shadowDropper.shadows);
  for (shadow of shadows) {
    shadow.root.visible = active;
  }
}

function togglePostproduction(active) {
  viewer.context.renderer.postProduction.active = active;
}

async function preposcessIfc(building) {
  // let url = building.ifcURL
  let fileRoute = `${province.term}_${city.name}_${site.id}_${building.id}_`;
  // Export to glTF and JSON
  // const url = URL.createObjectURL(file);
  const result = await viewer.GLTF.exportIfcFileAsGltf({
    ifcFileUrl: ifcURL,
    splitByFloors: false,
    categories: {
      walls: [IFCWALL, IFCWALLSTANDARDCASE],
      slabs: [IFCSLAB],
      windows: [IFCWINDOW],
      curtainwalls: [IFCMEMBER, IFCPLATE, IFCCURTAINWALL],
      doors: [IFCDOOR],
      roofs:[IFCROOF],
    },
    getProperties: true,
  });


    // Download result
    const link = document.createElement('a');
    document.body.appendChild(link);

    for(const categoryName in result.gltf) {
        const category = result.gltf[categoryName];
        for(const levelName in category) {
            const file = category[levelName].file;
            if(file) {
                link.download = `${fileRoute}_${categoryName}_allFloors.gltf`;
                link.href = URL.createObjectURL(file);
                link.click();
            }
		}
    }

    for(let jsonFile of result.json) {
        link.download = `${fileRoute}_${jsonFile.name}.json`;
        link.href = URL.createObjectURL(jsonFile);
        link.click();
    }

    link.remove();


  // // Download result
  // let link = document.createElement("a");
  // document.body.appendChild(link);

  // for (const categoryName in result.gltf) {
  //   const category = result.gltf[categoryName];
  //   for(const levelName in category) {
  //   const file = category[levelName].file;
  //     if (file) {
  //       link.download = `${fileRoute}${categoryName}_allFloors.gltf`;
  //       link.href = URL.createObjectURL(file);
  //       link.click();
  //     }
  //   }
  // }

  // for (let jsonFile of result.json) {
  //   link.download = `${fileRoute}${jsonFile.name}`;
  //   link.href = URL.createObjectURL(jsonFile);
  //   link.click();
  // }

  //   link.remove();
}