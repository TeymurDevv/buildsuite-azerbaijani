import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
  new URL(
    "../../buildsuite_core/public/js/desk_az_record_labels.js",
    import.meta.url
  ),
  "utf8"
);
const manifest = {
  "Project Type": ["External"],
  Task: ["Testing & commissioning"],
  Report: { "BuildSuite Example": "Example" },
  Notification: { "Integration Request": "[Error] {{ doc.method }}" },
  "Email Template": {
    "Dispatch Notification": "Your order is out for delivery!",
  },
  dispatch_bodies: ["<p>Dispatch Notification</p>"],
};
function setup(lang = "az") {
  const context = {
    frappe: { boot: { lang, buildsuite_desk_labels: manifest } },
    __: (text, _arguments, doctype) => doctype + "/" + text,
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return context.buildsuiteDeskRecordLabels;
}

test("activates only for Azerbaijani", () => {
  assert.equal(setup("en"), undefined);
  assert.ok(setup("az-Latn-AZ"));
});

test("translates fixture IDs without changing source records or arbitrary dictionary words", () => {
  const { display } = setup();
  const report = { name: "BuildSuite Example" };
  assert.equal(
    display("Report", "name", report.name, report),
    "Report/Example"
  );
  assert.deepEqual(report, { name: "BuildSuite Example" });
  assert.equal(
    display("Project Type", "name", "Sales", { name: "Sales" }),
    "Sales"
  );
});

test("a company suffix and standard parent identify seeded warehouse and department children", () => {
  const { display } = setup();
  const wh = {
    name: "Stores - CO",
    parent_warehouse: "All Warehouses - CO",
    is_group: 0,
  };
  assert.equal(
    display("Warehouse", "name", wh.name, wh),
    "Warehouse/Stores - CO"
  );
  assert.equal(
    display("Warehouse", "name", wh.name, {
      ...wh,
      parent_warehouse: "Custom - CO",
    }),
    wh.name
  );
  const dept = { name: "Accounts - CO", parent_department: "All Departments" };
  assert.equal(
    display("Department", "name", dept.name, dept),
    "Department/Accounts - CO"
  );
  assert.equal(
    display("Department", "name", dept.name, {
      ...dept,
      parent_department: "East",
    }),
    dept.name
  );
});

test("template Task subjects require both the template flag and a shipped subject", () => {
  const { display } = setup(),
    subject = "Testing & commissioning";
  assert.equal(
    display("Task", "subject", subject, { is_template: 1 }),
    "Project template task/" + subject
  );
  assert.equal(
    display("Task", "subject", subject, { is_template: 0 }),
    subject
  );
  assert.equal(
    display("Task", "subject", "Custom", { is_template: 1 }),
    "Custom"
  );
});

test("modified notification subjects and Dispatch styles/links remain under native editing", () => {
  const labels = setup();
  assert.equal(
    labels.display("Notification", "subject", "Custom", {
      name: "Integration Request",
    }),
    "Custom"
  );
  const subject = "Your order is out for delivery!";
  assert.equal(
    labels.dispatchSubject('{{ _("Your order is out for delivery!") }}'),
    "Email Template/" + subject
  );
  assert.equal(labels.dispatchSubject("Custom"), null);
  assert.equal(
    labels.dispatchPreview('<p style="color: blue">Dispatch Notification</p>'),
    null
  );
  assert.equal(
    labels.dispatchPreview('<p><a href="./new">Dispatch Notification</a></p>'),
    null
  );
});
