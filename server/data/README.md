# IBA 后端目录

`catalog.json` 是服务端发布、TCB `cocktails` / `ingredients` 集合初始化所用的公开业务数据，含 102 款完整酒谱和 162 种配料。三类各 34 款；分类与英文名直接取自 IBA 官方页面。原有 39 款酒和 68 种配料的 ID 均保留，已有收藏及酒柜无需迁移。

`iba-editorial.json` 保存中文名、中文方法、配料归一与已审核的官方原文。`data/iba-cocktails/recipes-source.json` 保存 2026-10-30 抓取的官方材料、方法、装饰及来源 URL。原图和蜡笔图沿用同目录 `manifest.json`，酒谱只引用服务端 `/media/cocktails/` 路径。

离线重建与校验：

```sh
python3 scripts/import-iba-catalog.py
python3 scripts/import-iba-catalog.py --check
```

重新从官方 sitemap 抓取全部配方：

```sh
python3 scripts/import-iba-catalog.py --refresh
```

联网刷新需要 Python `requests`。如果官方材料、方法、装饰或收录集合改变，构建会报错；先复核 `recipes-source.json` 的差异，再更新中文编辑稿及图片，避免把新原文自动覆盖进未审核中文酒谱。`--fetch-only` 仅更新官方快照。

编辑约定：

- 官方标为 Optional 的原料保留为可选项；当前数据模型使用 `is_essential: false, is_garnish: true`，制作匹配不会要求它。
- 二选一的基酒只选一个完整版本，例如古典选波本，纽约酸选黑麦；官方替代说明保留在来源快照，避免将两款酒都列为必需。
- 细分朗姆、风味伏特加、老汤姆金酒及利口酒使用独立配料 ID，不与普通基酒混同。名称和别名在归一后不可冲突。
- Three Dots and a Dash 官方把多香果利口酒与青柠汁连写在同一材料行；编辑稿拆成 7.5 ml 与 15 ml。IBA Tiki 官方菠萝汁和青柠汁漏写单位，按同配方液体单位规范为 90 ml 和 30 ml。原文和处理依据见编辑稿 `source_notes`。
- 官方未细分的 Rum / Cuban Rum，在海明威特调和唐氏特调代基里中选用白朗姆版本；这两处选择同样记录在 `source_notes`。不把常见变体当成官方另增酒款。

所有酒谱与配料都是普通 JSON 对象，可直接以 `id` 为 TCB 文档 ID 使用 `doc(id).set(record)`。TCB 的导入导出与部署流程由服务端脚本负责。
