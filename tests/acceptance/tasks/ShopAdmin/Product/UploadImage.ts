import { expect, test as base } from '@playwright/test';
import { FixtureTypes } from '@fixtures/FixtureTypes';
import type { Task } from '@fixtures/Task';
import { createRandomImage, getMediaId } from '@fixtures/Helper';
import fs from 'fs';

export const UploadImage = base.extend<{ UploadImage: Task }, FixtureTypes>({
    UploadImage: async ({ adminProductDetailPage, adminApiContext }, use ) => {

        let imageFilePath: string;
        let fileName: string;

        const task = (imageName: string) => {
            return async function UploadImage() {

                fileName = imageName;
                imageFilePath = `./tmp/${ imageName }.png`;

                if (!fs.existsSync('./tmp/')) {
                    try {
                        fs.mkdirSync('./tmp/');
                    } catch (err) {
                        console.error(err);
                    }
                }

                // Create Image
                const image = createRandomImage();
                fs.writeFileSync(imageFilePath, image.toBuffer());

                const fileChooserPromise = adminProductDetailPage.page.waitForEvent('filechooser');
                await adminProductDetailPage.uploadMediaButton.click();
                const fileChooser = await fileChooserPromise;
                await fileChooser.setFiles(imageFilePath);

                // Wait until media is saved via API
                const response = await adminProductDetailPage.page.waitForResponse(`${ process.env['APP_URL'] }api/search/media`);

                // Assertions
                await expect(response.ok()).toBeTruthy();
                const mediaResourceResponse = await response.json();
                expect(mediaResourceResponse.data[0]).toEqual(
                  expect.objectContaining({
                      attributes: expect.objectContaining({
                          fileName: imageName,
                          mimeType: 'image/png',
                      }),
                  }),
                );
            }
        }
        await use(task);

        //Delete image from database
        const uploadedMediaId = await getMediaId(fileName, adminApiContext);
        const deleteUploadedMedia = await adminApiContext.delete(`media/${ uploadedMediaId }`);
        await expect(deleteUploadedMedia.ok()).toBeTruthy();

        // Delete image from dir
        fs.unlink(imageFilePath, (err) => {
            if (err) {
                throw err;
            }
        });
    },
});
