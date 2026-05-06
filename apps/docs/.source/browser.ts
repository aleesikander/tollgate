// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"api-reference.mdx": () => import("../content/docs/api-reference.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "policy-dsl.mdx": () => import("../content/docs/policy-dsl.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), "integrations/slack.mdx": () => import("../content/docs/integrations/slack.mdx?collection=docs"), "sdks/python.mdx": () => import("../content/docs/sdks/python.mdx?collection=docs"), "sdks/typescript.mdx": () => import("../content/docs/sdks/typescript.mdx?collection=docs"), }),
};
export default browserCollections;