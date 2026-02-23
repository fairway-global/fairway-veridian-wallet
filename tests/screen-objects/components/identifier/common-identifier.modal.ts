export class CommonIdentifierModal {
  get colorTitle() {
    return $("[data-testid=\"color-input-title\"]");
  }

  colorItem(index: number) {
    return $(`[data-testid="color-${index}"]`);
  }

  get displayNameTitle() {
    return $("[data-testid=\"display-name-input-title\"]");
  }

  get themeTitle() {
    return $("[data-testid=\"theme-input-title\"]");
  }

  themeItem(index: number) {
    return $(`[data-testid="identifier-theme-selector-item-${index}"]`);
  }

  async clickChosenTheme(index: number) {
    await this.themeItem(index).click();
  }

  displayNameInputElement(elementName: string) {
    return $(`#${elementName}-name-input input`);
  }

  getIdElementLocator(elementName: string) {
    return `[data-testid="${elementName}-identifier-modal"]`;
  }

  idElement(elementName: string) {
    return $(this.getIdElementLocator(elementName));
  }

  identifierTypeItem(name: string) {
    return $(`[data-testid="identifier-aidtype-${name.toLowerCase()}"]`);
  }

  modalTitleElement(elementName: string) {
    return $(`[data-testid="${elementName}-title"]`);
  }

  async clickChosenIdentifierType(identifierType: string) {
    await this.identifierTypeItem(identifierType).click();
  }
}

export default new CommonIdentifierModal();
