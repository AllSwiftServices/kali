export function createPageUrl(pageName: string) {
    if (pageName === 'Home' || pageName === '/' || pageName === '') return '/';
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}