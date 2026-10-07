import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real component handlers without network writes or a signed-in account.
function harness(overrides = {}) {
  let cursor = 0;
  const hooks = [];
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect() { cursor++; },
  };
  const source = readFileSync(new URL("../features/social/components/post-card.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const context = {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name.endsWith("/profile")) return { avatarFor: () => "", initialsAvatar: () => "", formatRelativeTime: () => "now" };
      if (name.endsWith("/native-social")) return { nativeImpact() {}, shareExternal() {} };
      return () => null;
    },
    window: { matchMedia: () => ({ matches: true }), clearTimeout() {}, setTimeout() {} },
  };
  vm.runInNewContext(code, context);
  const props = {
    post: { id: "post", profile: { id: "author", username: "author", display_name: "Author" }, caption: "", comments: [], commentCount: 0, likeCount: 0, media_type: null },
    currentUserId: "viewer", own: false, saved: false,
    onComment: async () => true,
    ...overrides,
  };
  function render() { cursor = 0; return exports.default(props); }
  return { render, props };
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, predicate); if (found) return found; }
  } else {
    if (predicate(node)) return node;
    return find(node.props?.children, predicate);
  }
}
const commentInput = tree => find(tree, node => node.type === "input" && node.props["aria-label"] === "Add a comment");
const form = tree => find(tree, node => node.type === "form" && node.props.className === "comment-input");

test("comment submission blocks repeated taps, retains failed drafts and clears only after success", async () => {
  let release;
  let calls = 0;
  const component = harness({ onComment: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  commentInput(component.render()).props.onChange({ target: { value: "Keep this draft" } });
  const submit = form(component.render()).props.onSubmit;
  const first = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(calls, 1);
  assert.equal(form(component.render()).props["aria-busy"], true);
  assert.equal(commentInput(component.render()).props.disabled, true);
  release(false);
  await first;
  assert.equal(commentInput(component.render()).props.value, "Keep this draft");
  assert.ok(find(component.render(), node => node.props.role === "alert"));
  component.props.onComment = async () => true;
  await form(component.render()).props.onSubmit({ preventDefault() {} });
  assert.equal(commentInput(component.render()).props.value, "");
  assert.equal(form(component.render()).props["aria-busy"], false);
});

test("unexpected comment rejection stays recoverable", async () => {
  const component = harness({ onComment: async () => { throw new Error("offline"); } });
  commentInput(component.render()).props.onChange({ target: { value: "Still here" } });
  await form(component.render()).props.onSubmit({ preventDefault() {} });
  assert.equal(commentInput(component.render()).props.value, "Still here");
  assert.equal(commentInput(component.render()).props.disabled, false);
});

test("carousel keyboard navigation respects bounds and reduced motion", () => {
  const component = harness();
  component.props.post.media_type = "image";
  component.props.post.mediaItems = [{ id: "one", url: "/one" }, { id: "two", url: "/two" }];
  const track = find(component.render(), node => node.props.className === "post-carousel-track");
  const scrolls = [];
  track.props.ref.current = { clientWidth: 300, scrollTo: value => scrolls.push(value) };
  track.props.onKeyDown({ key: "ArrowLeft", preventDefault() {} });
  track.props.onKeyDown({ key: "ArrowRight", preventDefault() {} });
  assert.equal(scrolls[0].left, 0);
  assert.equal(scrolls[1].left, 300);
  assert.equal(scrolls[1].behavior, "instant");
  track.props.onScroll({ currentTarget: { clientWidth: 300, scrollLeft: 300 } });
  const next = find(component.render(), node => node.props["aria-label"] === "Next image");
  assert.equal(next.props.disabled, true);
});
