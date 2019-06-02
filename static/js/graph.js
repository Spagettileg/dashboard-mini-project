queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);
    
function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData); //Crossfilter gets passed to the function that will draw the graph
    
    salaryData.forEach(function(d){ 
        d.salary = parseInt(d.salary);  // Converts text to numbers to help populate data on 'average' graph
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
        d.yrs_service = parseInt(d["yrs.service"]); // Coverts string data to Integers. Helps show scatter dots
    });
    
    show_discipline_selector(ndx);
    
    show_percent_that_are_professors(ndx, "Female", "#percentage-of-women-professors"); 
    show_percent_that_are_professors(ndx, "Male", "#percentage-of-men-professors"); 
    
    show_gender_balance(ndx); //#gender-balance is the function for drawing the graph
    show_average_salary(ndx);
    show_rank_distribution(ndx);
    
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);
    
    dc.renderAll(); // Essential command for Bar Chart to appear
}

function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck('discipline')); // Both dimension & group created and passed back to dimensional charting select menu
    group = dim.group();
    
    dc.selectMenu('#discipline-selector') // x2 properties only
        .dimension(dim)
        .group(group);
}

function show_percent_that_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
        },
        function (p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        function () {
            return {count: 0, are_prof: 0};
        }
        
        );
        
        dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function (d) {
            if (d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf);
}

function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();
    
    dc.barChart("#gender-balance")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal()) // Male & Female atrributes used instead of numbers 
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender") //Ordinal data
        .yAxis().ticks(20);   //Count 
}

function show_average_salary(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    
    function add_item(p, v) { // p is an accumulator and keeps track of the total count
        p.count++; // Increment the count in our p object  
        p.total += v.salary; // We increment our total by the value of the salary we're looking at
        p.average = p.total / p.count; // Average salary calculation
        return p; // Important command. Absence will create errors 
    }
    
    function remove_item(p, v) { // v represents each of the data items being added or removed 
        p.count--; // Reduce the count in our p object  
            if(p.count == 0) { // Count value will not be less than Zero & avoid a DIV#0 error
                p.total = 0;
                p.average = 0;
            }else {
                p.total -= v.salary; // We reduce our total by the value of the salary we're looking at
                p.average = p.total / p.count; // Average salary calculation
            }
        return p;
    }
    
    function initialise() { // Creates an initial value for p
        return {count: 0, total: 0, average: 0};
    }
    
    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialise); 
    
    console.log(averageSalaryByGender.all());
    
    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d){
            return d.value.average.toFixed(2); // Average numbers to be plotted in bar chart. 'ToFixed' changes number od decimal places 
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal()) // Ordinal scale used as units are Male & Female
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxis().ticks(4); 
    
}

function show_rank_distribution(ndx) { // Designed to confirm count of rank, by gender 

    function rankByGender (dimension, rank) {
        return dimension.group().reduce(
            function (p, v) {
                p.total++;
                if(v.rank == rank) {
                    p.match++;
                }
                return p;
            },
            function (p, v) {
                p.total--;
                if(v.rank == rank) {
                    p.match--;
                }
                return p;
            },
            function () {
                return {total: 0, match: 0};
            }
        );
    }

    var dim = ndx.dimension(dc.pluck('sex'));
    var profByGender = rankByGender(dim, "Prof");
    var asstProfByGender = rankByGender(dim, "AsstProf");
    var assocProfByGender = rankByGender(dim, "AssocProf");
    
    dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        .dimension(dim)
        .group(profByGender, "Prof") // x3 ranks will appear in the Legend 
        .stack(asstProfByGender, "Asst Prof")
        .stack(assocProfByGender, "Assoc Prof")
        .valueAccessor(function(d) {
            if(d.value.total > 0) {
                return (d.value.match / d.value.total) * 100; // Creates a percentage of both Male / Female populations
            } else {
                return 0;
            }
        })
        .x(d3.scale.ordinal())
        .xAxisLabel("Gender")
        .xUnits(dc.units.ordinal)
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({top: 10, right: 100, bottom: 30, left: 30}); // Position of Legend in margins of chart
        
}

function show_service_to_salary_correlation(ndx) { // Establish correlation between x (yrs service) & y (salary)

    var genderColors = d3.scale.ordinal() // Add colour to the scatter plot
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);

    var eDim = ndx.dimension(dc.pluck("yrs_service")); // For x-axis
    var experienceDim = ndx.dimension(function(d) { // For y-axis
        return [d.yrs_service, d.salary, d.rank, d.sex]; // Array =  d.yrs =[0], service = [1] & d.salary = [2]
    });
    var experienceSalaryGroup = experienceDim.group();

    var minExperience = eDim.bottom(1)[0].yrs_service; // Extracts minimum years experience
    var maxExperience = eDim.top(1)[0].yrs_service; // Extracts maximum years experience

    dc.scatterPlot("#service-salary") // Create Scatter Plot Chart
        .width(800) // Consistent with width of Bar-chart
        .height(400) // Consistent with height of Bar-chart
        .x(d3.scale.linear().domain([minExperience, maxExperience])) // Linear scale as number are being used and not names (Ordinal)
        .brushOn(false) // Brush turned off = false
        .symbolSize(8)
        .clipPadding(10) // Leaves room at top of plot, if a plot dot exists there
        .yAxisLabel("Salary")
        .xAxisLabel("Years Of Service")
        .title(function(d) { // Message provided when mouse hovered over dot
            return d.key[2] + " earned " + d.key[1]; //refer to row 190. d.key[2]=salary & d.key[1]=service (follows index principle)
        })
        .colorAccessor(function(d) { // Focus on 'Sex' element to separate colours - pink & blue
            return d.key[3]; // d.key [3] relates to d.sex (4th in the Array) on row 196
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
}

function show_phd_to_salary_correlation(ndx) { // Establish correlation between x (yrs since PhD) & y (salary)

    var genderColors = d3.scale.ordinal() // Add colour to the scatter plot
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);

    var pDim = ndx.dimension(dc.pluck("yrs_since_phd")); // For x-axis
    var phdDim = ndx.dimension(function(d) { // For y-axis
        return [d.yrs_since_phd, d.salary, d.rank, d.sex]; // Array =  d.yrs_since_phd =[0], d.salary = [1], d.rank = [2] & d.sex = [3]
    });
    var phdSalaryGroup = phdDim.group();

    var minPhd = pDim.bottom(1)[0].yrs_since_phd; // Extracts minimum years experience
    var maxPhd = pDim.top(1)[0].yrs_since_phd; // Extracts maximum years experience

    dc.scatterPlot("#phd-salary") // Create Scatter Plot Chart
        .width(800) // Consistent with width of Bar-chart
        .height(400) // Consistent with height of Bar-chart
        .x(d3.scale.linear().domain([minPhd, maxPhd])) // Linear scale as number are being used and not names (Ordinal)
        .brushOn(false) // Brush turned off = false
        .symbolSize(8)
        .clipPadding(10) // Leaves room at top of plot, if a plot dot exists there
        .yAxisLabel("Salary")
        .xAxisLabel("Years Of Since PhD")
        .title(function(d) { // Message provided when mouse hovered over dot
            return d.key[2] + " earned " + d.key[1]; //refer to row 190. d.key[2]=salary & d.key[1]=service (follows index principle)
        })
        .colorAccessor(function(d) { // Focus on 'Sex' element to separate colours - pink & blue
            return d.key[3]; // d.key [3] relates to d.sex (4th in the Array) on row 196
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
}

    