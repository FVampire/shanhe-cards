import {expect,type Page} from '@playwright/test';
export async function createCharacter(page:Page){
 await expect(page.getByLabel('你的姓名',{exact:true})).toBeEnabled();await page.getByLabel('你的姓名',{exact:true}).fill('陆青禾');await page.getByRole('button',{name:'记下姓名'}).click();await page.getByTestId('origin-traveller').click();await page.getByTestId('talent-steady').click();await page.getByRole('button',{name:'踏上青溪岸'}).click();
}
