import { createRenderer, defineComponent, h, nextTick } from 'vue'

// addEventListener: v-model attaches its listeners directly to the element. style: the chat input resizes itself.
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, style: {}, addEventListener() {} })
const renderer = createRenderer({
  createElement: tag => node(tag), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, prev, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
    el.parent = parent
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
export const nodes = root => [root, ...root.children.flatMap(nodes)]
export const textOf = root => root.text + root.children.map(textOf).join(' ')
export const button = (root, text) => nodes(root).find(el => el.type === 'button' && textOf(el).includes(text))
export const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); await nextTick() }
export function mount(component, props) {
  const root = node('root')
  const app = renderer.createApp(defineComponent({ render: () => h(component, props) }))
  app.mount(root)
  return { app, root }
}
