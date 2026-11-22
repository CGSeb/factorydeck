# Design reference: B4

Temporary reference for the redesign of specs 014 to 030. Spec 030 deletes this folder once every page has its new look: from then on, Storybook and the app are the reference.

Each file of `b4/` is one screen of the validated mockup, with synthetic data:

| File               | Screen                              | Specs    |
| ------------------ | ----------------------------------- | -------- |
| `b4/overview.html` | Overview                            | 024      |
| `b4/features.html` | Features list                       | 025      |
| `b4/issue.html`    | Issue page                          | 026      |
| `b4/sessions.html` | Sessions list                       | 027      |
| `b4/session.html`  | Session page                        | 027      |
| `b4/skills.html`   | Skills list                         | 028      |
| `b4/skill.html`    | Skill page                          | 028      |
| `b4/roles.html`    | Roles                               | 029      |
| `b4/welcome.html`  | No session yet                      | 023      |
| `b4/missing.html`  | Factory file missing, delete dialog | 023      |
| `b4/phone.html`    | Overview at 360 px                  | 023, 024 |

## Reading a file

The files come from a design canvas and do not render on their own (they load the canvas runtime, `support.js`). Read them as markup:

- The layout, sizes, spacing and colours are the inline `style` attributes.
- `{{name}}` is a value computed in the `renderVals()` method of the `<script type="text/x-dc">` block at the end of the file; `<sc-for list="{{items}}" as="item">` repeats its content for each item, `<sc-if>` shows it on a condition.
- The data in `renderVals()` is synthetic and only illustrates the layout; figures follow the specs, not the mockup.
- Hover tooltips are the `.tip` and `.tip-pop` rules of each file's `<style>`.

When a spec and a mockup disagree, the spec wins. Exact values (colours, fonts, sizes) are in `src/ui/design/tokens.css` once spec 014 is merged.
