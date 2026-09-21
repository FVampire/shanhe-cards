import type {ResearchDomain} from '../domain/research-model';
export const researchDomains:Record<ResearchDomain,{name:string;base:string;choices:string[];fixed:string;normal:string;alternate:string;deviation:string;principle:string}>={
 alchemy:{name:'炼丹',base:'xp.herb',choices:['xp.water','xp.ash'],fixed:'xp.salve',normal:'xp.restorative',alternate:'xp.mind',deviation:'xp.warm',principle:'药草与辅料合炼；缓火与逆炼会改变反应。一次成丹不证明产出概率。'},
 craft:{name:'炼器',base:'xp.iron',choices:['xp.quartz','xp.copper'],fixed:'xp.furnace',normal:'xp.probe',alternate:'xp.reservoir',deviation:'xp.unstable',principle:'金属与引灵材料合炼；稳锻可制基础炉，导灵与蓄灵各有用途。'},
 practice:{name:'功法',base:'xp.breath',choices:['xp.flow','xp.still'],fixed:'xp.calm',normal:'xp.link',alternate:'xp.link',deviation:'xp.strain',principle:'先收气与逆转是不同运行步骤；低强度试行可以观察兼容，强行冲突须先处置征兆。'}
};
export const researchItems:Record<string,string>={'xp.herb':'青叶草','xp.water':'寒泉液','xp.ash':'温灵灰','xp.iron':'青铁','xp.quartz':'白灵晶','xp.copper':'赤铜','xp.breath':'吐纳篇','xp.flow':'行气篇','xp.still':'守静篇','xp.salve':'基础药膏','xp.restorative':'回元丹','xp.mind':'养神丹','xp.warm':'温脉偏丹','xp.furnace':'调火炉','xp.probe':'探灵器','xp.reservoir':'蓄灵器','xp.unstable':'不稳蓄灵器','xp.calm':'收气心得','xp.link':'协同运转心得','xp.strain':'逆行观察'};
export const researchSteps={gentle:'缓火／先收气',reverse:'逆炼／先转脉',steady:'基础稳行'};
export const researchVariants=[{step:'gentle',materialIndex:0,weights:[800000,100000,90000,10000]},{step:'reverse',materialIndex:1,weights:[450000,450000,90000,10000]}] as const;
export function checkResearchContent(){
 for(const v of researchVariants)if(v.weights.reduce((sum,n)=>sum+n,0)!==1000000)throw new Error('探索概率不完整');
 for(const d of Object.values(researchDomains))for(const id of [d.base,...d.choices,d.fixed,d.normal,d.alternate,d.deviation])if(!researchItems[id])throw new Error('探索内容缺少物品 '+id);
}
