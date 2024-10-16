function customSort(a, b, fancyTableObject, rowA, rowB){
    if(a==b && rowA && rowB){
        return(fancyTableObject.rowSortOrder[$(rowA).data("rowid")] > fancyTableObject.rowSortOrder[$(rowB).data("rowid")]);
    }
    if(fancyTableObject.sortAs[fancyTableObject.sortColumn] == 'numeric'){
        let aFloat = parseFloat(a.replace(/,/g, ''));
        let bFloat = parseFloat(b.replace(/,/g, ''));
        return(
            (fancyTableObject.sortOrder>0) ? aFloat-bFloat : bFloat-aFloat
        );
    }
    if (fancyTableObject.sortAs[fancyTableObject.sortColumn] == 'datetime') {
        return (fancyTableObject.sortOrder > 0) ? (Date.parse(a) - Date.parse(b)) : (Date.parse(b) - Date.parse(a));
    } else {
        return((a<b)?-fancyTableObject.sortOrder:(a>b)?fancyTableObject.sortOrder:0);
    }
}