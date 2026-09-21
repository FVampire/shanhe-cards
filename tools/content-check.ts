import {checkResearchContent} from '../src/content/research';
checkResearchContent();
import {validateMortalContent} from '../src/content/mortal';
const mortal=validateMortalContent();console.log('凡尘篇正式内容：'+mortal.chains.length+' 条链、'+mortal.places.length+' 地点、'+mortal.roles.length+' 角色席位、'+mortal.methods.length+' 初修方法；短事件 '+mortal.shortSeeds.length+' 项。');
import { readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { content,validateContent } from '../src/content';
validateContent(content);
const files=readdirSync(resolve('src/domain')).filter(f=>f.endsWith('.ts')&&f!=='dao.ts');
for(const file of files){const text=readFileSync(resolve('src/domain',file),'utf8');if(/displayDao|AddDao|Math\.random\(/.test(text))throw new Error(file+': 普通领域规则不得直接求和道行或调用不稳定随机');}
const sample=JSON.parse(readFileSync(resolve('docs/reference/examples/内容样例.json'),'utf8'));
const ids=new Set<string>();for(const key of ['domains','skills','professions','knowledgeDefinitions','itemDefinitions','workTopics','statuses','locations','actions','eventDefinitions','specialEffectProfiles','omenProfiles'])for(const def of sample[key]){if(ids.has(def.id))throw new Error('参考样例 ID 重复');ids.add(def.id);}
console.log('正式内容：'+content.actions.length+' 项行动、'+content.items.length+' 类器物、'+content.professions.length+' 类职业；操作白名单、引用与道行边界检查通过。');
console.log('参考样例 JSON 解析及 ID 唯一性通过；其草案结构保留于 docs/reference，不作为发布包导入。');