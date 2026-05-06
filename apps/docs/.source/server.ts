// @ts-nocheck
import * as __fd_glob_9 from "../content/docs/sdks/typescript.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/sdks/python.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/integrations/slack.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/policy-dsl.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/api-reference.mdx?collection=docs"
import { default as __fd_glob_2 } from "../content/docs/integrations/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/sdks/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "sdks/meta.json": __fd_glob_1, "integrations/meta.json": __fd_glob_2, }, {"api-reference.mdx": __fd_glob_3, "index.mdx": __fd_glob_4, "policy-dsl.mdx": __fd_glob_5, "quickstart.mdx": __fd_glob_6, "integrations/slack.mdx": __fd_glob_7, "sdks/python.mdx": __fd_glob_8, "sdks/typescript.mdx": __fd_glob_9, });