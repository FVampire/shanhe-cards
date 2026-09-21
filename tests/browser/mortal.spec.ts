import {test,expect,type Page} from '@playwright/test';
async function boot(page:Page){await page.goto('/');await expect(page.getByRole('button',{name:'踏上青溪岸'})).toBeEnabled();await page.getByRole('button',{name:'踏上青溪岸'}).click();}
async function act(page:Page,choice?:string){if(choice)await page.locator('.m-choices').getByRole('button',{name:choice,exact:false}).click();await page.getByRole('button',{name:'自身槽位',exact:true}).click();await page.getByRole('button',{name:'开始这段行事'}).click();await page.getByRole('button',{name:'推进到下一项结果'}).click();}
test('独自创角、实际劳动、取消不领奖、刷新延续人物与阶段',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);await expect(page.getByTestId('money')).toHaveText('24');await expect(page.getByRole('heading',{name:'集口告示'})).toBeVisible();
 await page.screenshot({path:'docs/screenshots/凡尘-独自落脚.png',fullPage:true});
 await act(page,'先看公开告示');await expect(page.getByRole('heading',{name:'今夜落脚'})).toBeVisible();await act(page,'包食宿帮工');await expect(page.getByTestId('money')).toHaveText('30');await act(page,'完成公共短工');await expect(page.getByTestId('money')).toHaveText('42');
 await page.getByRole('button',{name:'相识与旧友'}).click();await expect(page.locator('.m-contact').first()).toBeVisible();await page.getByRole('button',{name:'案上行事'}).click();
 await page.getByRole('button',{name:'公共短工 · 12 文'}).click();await page.getByRole('button',{name:'自身槽位'}).click();await page.getByRole('button',{name:'开始这段行事'}).click();await expect(page.getByTestId('money')).toHaveText('42');await page.getByRole('button',{name:'取消并结清'}).click();await expect(page.getByTestId('money')).toHaveText('42');
 await expect(page.getByRole('button',{name:'保存状态'})).toContainText('已保存到本机');await page.reload();await expect(page.getByTestId('money')).toHaveText('42');await expect(page.locator('.m-chain').filter({hasText:'初到青溪'})).toContainText('已完成');expect(errors).toEqual([]);
});
test('窄屏地图、点击替代拖拽、存档与字体可达',async({page})=>{
 await page.setViewportSize({width:390,height:844});await boot(page);await page.getByRole('button',{name:'远近山河'}).click();await expect(page.locator('.m-place')).toHaveCount(10);await page.locator('.m-place').filter({hasText:'河埠客舍'}).getByRole('button').click();await act(page);await expect(page.locator('.m-purse')).toContainText('河埠客舍');await page.getByRole('button',{name:'存档与设置'}).click();await page.getByLabel('字体大小').selectOption('130');await expect(page.getByRole('button',{name:'导出存档'})).toBeVisible();expect(await page.evaluate(()=>document.querySelector('.mortal-app')!.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/screenshots/凡尘-窄屏.png',fullPage:true});
});
test('预览与拖拽自身不改变钱款，选错地点明确提供出行',async({page})=>{
 await boot(page);await page.getByRole('button',{name:'CH09 · 人生际遇 三扇门',exact:false}).click();await page.getByRole('button',{name:'买公开基础注本',exact:false}).click();await expect(page.locator('.m-errors')).toContainText('县学书院');await page.getByRole('button',{name:'投入自身',exact:true}).dragTo(page.getByRole('region',{name:'行事台'}));await expect(page.getByRole('button',{name:'自身槽位'})).toContainText('陆青禾');await expect(page.getByTestId('money')).toHaveText('24');await expect(page.getByRole('button',{name:'开始这段行事'})).toBeDisabled();
});
