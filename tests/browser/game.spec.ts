import {createCharacter} from './setup';
import {createLegacyWorld} from '../../src/domain/world';
import {envelope} from '../../src/infrastructure/save';
import { test,expect,type Page,type Locator } from '@playwright/test';
async function boot(page:Page){
 await page.goto('/');await createCharacter(page);await page.getByRole('button',{name:'存档',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope(createLegacyWorld())))});
 await expect(page.getByTestId('card-character.learner')).toBeVisible();await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');
}
async function drag(page:Page,source:Locator,to:{x:number;y:number}){const r=await source.boundingBox();if(!r)throw Error('drag source missing');await page.mouse.move(r.x+r.width/2,r.y+Math.min(35,r.height/2));await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:14});await page.mouse.up();}
async function fill(page:Page,slot:string,id:string){await page.getByTestId('slot-'+slot).click();await page.getByTestId('card-'+id).click();await expect(page.getByTestId('slot-'+slot).locator('.slotted-card')).toHaveCount(1);}
async function prepare(page:Page,verb:string,pairs:[string,string][]){await page.getByRole('button',{name:verb,exact:true}).click();for(const [slot,id]of pairs)await fill(page,slot,id);await expect(page.getByRole('button',{name:'开始行事',exact:false})).toBeEnabled();await page.getByRole('button',{name:'开始行事',exact:false}).click();}
async function finish(page:Page){for(let i=0;i<12;i++){if(await page.getByRole('button',{name:'收取成果',exact:false}).count())return;await page.getByRole('button',{name:'等候下一进展'}).click();}throw Error('未能完成行动');}
async function collect(page:Page){await page.getByRole('button',{name:'收取成果',exact:false}).click();}
async function closeVerb(page:Page){await page.locator('.verb-window').getByRole('button',{name:'关闭窗口'}).click();}
const converse:[string,string][]=[['actor','character.learner'],['companion','character.teacher']];
const duet:[string,string][]=[['actor','character.learner'],['companion','character.teacher'],['instrument','instance.qin'],['score','instance.score']];
const compose:[string,string][]=[['actor','character.learner'],['focus','instance.qin'],['score','instance.score']];
async function reply(page:Page,title:string,option:string){await page.locator('.pending-ribbon').getByRole('button',{name:title,exact:false}).click();await page.getByRole('dialog',{name:title}).getByRole('button',{name:option,exact:true}).click();await page.getByRole('button',{name:'落定这一选择',exact:false}).click();}
async function travel(page:Page,id:string){await page.getByRole('button',{name:'行游',exact:true}).click();await drag(page,page.locator('.verb-window .window-handle'),{x:600,y:610});await fill(page,'actor','character.learner');await fill(page,'destination',id);await page.getByRole('button',{name:'开始行事',exact:false}).click();await finish(page);await collect(page);await closeVerb(page);}

test('开局卡牌不压动词，视角可读，交游会点亮自身',async({page})=>{
 await boot(page);
 expect(Number((await page.getByTestId('zoom-label').innerText()).replace('%',''))).toBeGreaterThanOrEqual(75);
 const playerBox=await page.getByTestId('card-character.learner').boundingBox();
 const studyBox=await page.getByRole('button',{name:'研习',exact:true}).boundingBox();
 expect(playerBox&&studyBox).toBeTruthy();
 expect(playerBox!.x<studyBox!.x+studyBox!.width&&playerBox!.x+playerBox!.width>studyBox!.x&&playerBox!.y<studyBox!.y+studyBox!.height&&playerBox!.y+playerBox!.height>studyBox!.y).toBe(false);
 await page.getByRole('button',{name:'交游',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'交游'})).toBeVisible();
 await expect(page.getByTestId('card-character.learner')).toHaveClass(/eligible/);
});
test('县志可交游谈掌故，旧琴可放入修养',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'交游',exact:true}).click();
 await fill(page,'actor','character.learner');await fill(page,'companion','character.teacher');await fill(page,'lore','instance.history');
 await expect(page.getByRole('heading',{name:'谈地方掌故'})).toBeVisible();
 await expect(page.getByRole('button',{name:'开始行事',exact:false})).toBeEnabled();
 await page.getByRole('button',{name:'将这些卡牌放回桌面'}).click();
 await closeVerb(page);
 await page.getByRole('button',{name:'修养',exact:true}).click();
 await fill(page,'actor','character.learner');await fill(page,'focus','instance.qin');
 await expect(page.getByRole('heading',{name:'抚琴入静'})).toBeVisible();
 await page.getByRole('button',{name:'开始行事',exact:false}).click();
 await expect(page.getByTestId('card-instance.score')).toBeVisible();
 await finish(page);await collect(page);await closeVerb(page);
});
test('交游只需自己与沈知弦即可小坐，琴谱仍留在案上',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'人物志',exact:true}).click();
 await expect(page.locator('.situation-block').filter({hasText:'沈知弦'})).toContainText('仍在听雨亭');
 await page.locator('.ledger-window').getByRole('button',{name:'关闭窗口'}).click();
 await page.getByRole('button',{name:'交游',exact:true}).click();
 for(const [slot,id] of converse)await fill(page,slot,id);
 await expect(page.getByRole('heading',{name:'与沈先生小坐'})).toBeVisible();
 await expect(page.getByTestId('slot-instrument')).toBeVisible();
 await expect(page.getByRole('button',{name:'开始行事',exact:false})).toBeEnabled();
 await page.getByRole('button',{name:'开始行事',exact:false}).click();
 await expect(page.getByTestId('card-character.learner')).toHaveCount(0);
 await expect(page.getByTestId('card-instance.qin')).toBeVisible();
 await expect(page.getByTestId('card-instance.score')).toBeVisible();
 await finish(page);await collect(page);await closeVerb(page);
 await expect(page.getByTestId('card-character.learner')).toBeVisible();
 await expect(page.locator('.pending-ribbon')).toContainText('沈先生的去处');
 await page.getByRole('button',{name:'人物志',exact:true}).click();
 await expect(page.locator('.situation-block').filter({hasText:'沈知弦'})).toContainText('腕力不如从前');
});
test('真实拖放、属性拒绝、槽位取回、自由摆放与缩放均不消耗世界资源',async({page})=>{
 await boot(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'交游',exact:true}).click();const actor=page.getByTestId('slot-actor'),slot=await actor.boundingBox();if(!slot)throw Error('missing slot');
 await drag(page,page.getByTestId('card-instance.qin'),{x:slot.x+30,y:slot.y+50});await expect(actor.locator('.slotted-card')).toHaveCount(0);await expect(page.getByRole('status')).toContainText('容不下');
 await drag(page,page.getByTestId('card-character.learner'),{x:slot.x+30,y:slot.y+50});await expect(actor.locator('.slotted-card')).toHaveCount(1);await expect(page.getByTestId('card-character.learner')).toHaveCount(0);
 await drag(page,actor.locator('.slotted-card'),{x:140,y:540});await expect(actor.locator('.slotted-card')).toHaveCount(0);await expect(page.getByTestId('card-character.learner')).toBeVisible();
 await fill(page,'companion','character.teacher');
 await page.getByTestId('card-instance.qin').dblclick();await expect(page.getByTestId('slot-instrument').locator('.slotted-card')).toHaveCount(1);
 await page.getByRole('button',{name:'取回松纹旧琴'}).click();await expect(page.getByTestId('card-instance.qin')).toBeVisible();
 await closeVerb(page);if(await page.getByRole('button',{name:'收起卡牌详情'}).count())await page.getByRole('button',{name:'收起卡牌详情'}).click();
 await drag(page,page.getByTestId('card-instance.qin'),{x:740,y:440});const pos=await page.getByTestId('card-instance.qin').boundingBox();
 await page.getByRole('button',{name:'放大桌面'}).click();const zoom=await page.getByTestId('zoom-label').innerText();await expect(page.getByTestId('money')).toHaveText('24');
 await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');await page.waitForTimeout(250);await page.reload();await expect(page.getByTestId('zoom-label')).toHaveText(zoom);await expect(page.getByTestId('money')).toHaveText('24');expect(pos!.x).toBeGreaterThan(600);expect(errors).toEqual([]);
});

test('音乐闭环：投入、计时、收取、作品卡、来信、履约付款、晋升和存档刷新',async({page})=>{
 await boot(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<2;i++){
  await prepare(page,'交游',duet);await expect(page.getByTestId('card-character.learner')).toHaveCount(0);await finish(page);await expect(page.getByTestId('card-character.learner')).toHaveCount(0);await expect(page.locator('.verb-node.result-ready')).toHaveCount(1);await collect(page);await expect(page.getByTestId('card-character.learner')).toBeVisible();await closeVerb(page);
 }
 await prepare(page,'创作',compose);await finish(page);await expect(page.getByTestId('money')).toHaveText('24');await expect(page.getByRole('dialog',{name:'一封小集邀约'})).toHaveCount(0);await collect(page);await closeVerb(page);await expect(page.locator('.table-card .kind-work')).toHaveCount(1);
 await reply(page,'一封小集邀约','应下邀约');await expect(page.getByTestId('money')).toHaveText('24');
 await prepare(page,'谋生',compose);await finish(page);await expect(page.getByTestId('money')).toHaveText('60');await collect(page);await closeVerb(page);await reply(page,'琴声以外，岁月之内','寻访云游医师');
 await page.getByRole('button',{name:'人物志',exact:true}).click();await expect(page.locator('.situation-block').filter({hasText:'沈知弦'})).toContainText('仍在听雨亭');await expect(page.locator('.work-entry')).toContainText('江上曲 · 听雨');await page.getByRole('button',{name:'申请晋升',exact:true}).first().click();await expect(page.getByRole('button',{name:'已晋一级'})).toBeVisible();
 await page.getByRole('button',{name:'存档',exact:true}).click();await page.getByRole('button',{name:'保存此刻'}).click();await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档'}).click();const downloaded=await downloading;expect(downloaded.suggestedFilename()).toContain('山河问道');
 await page.reload();await expect(page.getByTestId('money')).toHaveText('60');await expect(page.getByRole('button',{name:'继续时间'})).toBeVisible();await expect(page.locator('.table-card .kind-work')).toHaveCount(1);expect(errors).toEqual([]);
});

test('运行和待收取均可刷新恢复；取消释放卡牌；损坏导入不替换当前世界',async({page})=>{
 await boot(page);await prepare(page,'交游',duet);await page.getByRole('button',{name:'暂停时间'}).click();await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');await page.reload();await expect(page.getByTestId('card-character.learner')).toHaveCount(0);await page.getByRole('button',{name:'交游',exact:true}).click();await finish(page);await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');await page.reload();await expect(page.getByTestId('card-character.learner')).toHaveCount(0);await page.getByRole('button',{name:'交游',exact:true}).click();await collect(page);await closeVerb(page);
 await prepare(page,'交游',duet);await page.getByRole('button',{name:'取消行事'}).click();await expect(page.getByTestId('card-character.learner')).toBeVisible();await closeVerb(page);await page.getByRole('button',{name:'存档',exact:true}).click();await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"saveSchemaVersion":0}')});await expect(page.locator('.table-toast')).toBeVisible();await expect(page.getByTestId('money')).toHaveText('24');
});

test('第二个窗口只读，投入卡牌也不能开始行动或覆盖存档',async({page,context})=>{
 await boot(page);const other=await context.newPage();await other.goto('/');await expect(other.getByText('只读窗口：',{exact:false})).toBeVisible();await other.getByRole('button',{name:'交游',exact:true}).click();for(const [slot,id]of duet)await fill(other,slot,id);await expect(other.getByRole('button',{name:'开始行事',exact:false})).toBeDisabled();await other.close();
});

test('书院出行、医者请益、调息与事件回应保持原规则',async({page})=>{
 await boot(page);await travel(page,'location.study');await page.getByRole('button',{name:'交游',exact:true}).click();await drag(page,page.locator('.verb-window .window-handle'),{x:1200,y:160});
 await fill(page,'actor','character.learner');await fill(page,'companion','character.physician');await expect(page.getByTestId('slot-instrument')).toHaveCount(0);await page.getByRole('button',{name:'开始行事',exact:false}).click();await finish(page);await collect(page);await closeVerb(page);await expect(page.getByTestId('money')).toHaveText('22');
 await prepare(page,'修养',[['actor','character.learner'],['focus','instance.breath']]);await finish(page);await collect(page);await closeVerb(page);await reply(page,'琴声以外，岁月之内','先好好歇息');await page.getByRole('button',{name:'人物志',exact:true}).click();await expect(page.locator('.meter').filter({hasText:'健康'})).toContainText('95');
});

test('药园职事与真实库存委托仍可从桌面完成',async({page})=>{
 await boot(page);await travel(page,'location.garden');await reply(page,'青竹药园的托付','接下药园职事');await page.getByRole('button',{name:'宗务',exact:true}).click();await page.getByRole('spinbutton').fill('10');await page.getByRole('button',{name:'启动委托'}).click();await page.locator('.ledger-window').getByRole('button',{name:'关闭窗口'}).click();await page.getByRole('button',{name:'谋生',exact:true}).click();
 for(let i=0;i<3;i++){await finish(page);await collect(page);}
 await closeVerb(page);await page.getByRole('button',{name:'宗务',exact:true}).click();await expect(page.getByText('不足：灵草 × 2',{exact:true})).toBeVisible();await expect(page.getByText('已完成',{exact:false})).toContainText('3');
});

test('桌面平移和窗口拖动；常用面板在1024与1440尺寸不产生页面横向溢出',async({page})=>{
 await boot(page);const before=await page.getByTestId('table-world').getAttribute('style');await page.mouse.move(160,420);await page.mouse.down();await page.mouse.move(280,470,{steps:10});await page.mouse.up();await expect(page.getByTestId('table-world')).not.toHaveAttribute('style',before!);
 for(const width of [1440,1024]){await page.setViewportSize({width,height:1000});await page.getByRole('button',{name:'视角归位'}).click();for(const name of ['人物志','宗务','日录','存档','指引']){await page.getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const box=await page.locator('.ledger-window').boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(width);await page.locator('.ledger-window').getByRole('button',{name:'关闭窗口'}).click();}}
});
