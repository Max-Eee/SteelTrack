import * as React from "react";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "../ui/sidebar";
import { cn } from "@/lib/utils";

export function FilterSidebar({ filters, onFilterChange, onClearFilters }) {
  const typeOptions = [
    "E",
    "GA",
    "GA1",
    "4",
    "5",
    "4N",
    "4G",
    "Scrap",
    "Paint",
    "Others",
  ];
  const qualityOptions = ["Soft", "Hard", "Semi"];
  // Function to get color scheme for different steel types (same as Dashboard)
  const getSteelTypeColors = (type) => {
    const colorMap = {
      E: "text-emerald-700 border-emerald-400 bg-emerald-50 hover:bg-emerald-100",
      GA: "text-blue-700 border-blue-400 bg-blue-50 hover:bg-blue-100",
      GA1: "text-indigo-700 border-indigo-400 bg-indigo-50 hover:bg-indigo-100",
      "4": "text-orange-700 border-orange-400 bg-orange-50 hover:bg-orange-100",
      "5": "text-red-700 border-red-400 bg-red-50 hover:bg-red-100",
      "4N": "text-purple-700 border-purple-400 bg-purple-50 hover:bg-purple-100",
      "4G": "text-teal-700 border-teal-400 bg-teal-50 hover:bg-teal-100",
      Scrap: "text-amber-700 border-amber-400 bg-amber-50 hover:bg-amber-100",
      Paint: "text-cyan-700 border-cyan-400 bg-cyan-50 hover:bg-cyan-100",
      Others: "text-slate-700 border-slate-400 bg-slate-50 hover:bg-slate-100",
    };
    return (
      colorMap[type] ||
      "text-gray-700 border-gray-400 bg-gray-50 hover:bg-gray-100"
    );
  };

  // Function to get color scheme for different quality types (same as Dashboard)
  const getQualityColors = (quality) => {
    const colorMap = {
      Soft: "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100",
      Hard: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100",
      Semi: "text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100",
    };
    return (
      colorMap[quality] ||
      "text-gray-700 border-gray-400 bg-gray-50 hover:bg-gray-100"
    );
  };

  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleFilterArray = (key, value) => {
    const currentArray = filters[key] || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value];
    handleFilterChange(key, newArray);
  };
  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      <div className="space-y-4 pb-4">
        <SidebarGroup>
          <SidebarGroupContent>
          <SidebarMenu>
            {/* Date Range */}
            <SidebarMenuItem>
              <div className="space-y-3 p-2">
                {" "}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate || ""}
                    onChange={(e) =>
                      handleFilterChange("startDate", e.target.value)
                    }
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate || ""}
                    onChange={(e) =>
                      handleFilterChange("endDate", e.target.value)
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
      {/* Type Filter */}
      <SidebarGroup>
        <SidebarGroupLabel>Type</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="p-2">
                <div className="flex flex-wrap gap-1">
                  {typeOptions.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs h-6 px-2 transition-all duration-200 shadow-sm font-medium",
                        getSteelTypeColors(type),
                        filters.type?.includes(type)
                          ? "ring-2 ring-offset-1 font-bold scale-105"
                          : "opacity-70 hover:opacity-100"
                      )}
                      onClick={() => toggleFilterArray("type", type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {/* Quality Filter */}
      <SidebarGroup>
        <SidebarGroupLabel>Quality</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="p-2">
                <div className="flex flex-wrap gap-1">
                  {qualityOptions.map((quality) => (
                    <Badge
                      key={quality}
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs h-6 px-2 transition-all duration-200 shadow-sm font-medium",
                        getQualityColors(quality),
                        filters.quality?.includes(quality)
                          ? "ring-2 ring-offset-1 font-bold scale-105"
                          : "opacity-70 hover:opacity-100"
                      )}
                      onClick={() => toggleFilterArray("quality", quality)}
                    >
                      {quality}
                    </Badge>
                  ))}
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
      {/* Text Filters */}
      <SidebarGroup>
        <SidebarGroupLabel>Search</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="space-y-3 p-2">
                {" "}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">LOT</Label>
                  <Input
                    value={filters.lot || ""}
                    onChange={(e) => handleFilterChange("lot", e.target.value)}
                    placeholder="Enter LOT"
                    className="h-8"
                  />
                </div>{" "}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Coating</Label>
                  <Input
                    value={filters.coating || ""}
                    onChange={(e) =>
                      handleFilterChange("coating", e.target.value)
                    }
                    placeholder="Enter Coating"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Specifications</Label>
                  <Input
                    value={filters.specifications || ""}
                    onChange={(e) =>
                      handleFilterChange("specifications", e.target.value)
                    }
                    placeholder="Enter Specifications"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Sold To</Label>
                  <Input
                    value={filters.soldTo || ""}
                    onChange={(e) =>
                      handleFilterChange("soldTo", e.target.value)
                    }
                    placeholder="Customer name"
                    className="h-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Form</Label>
                  <div className="space-y-2">
                    {" "}
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="form"
                        checked={!filters.form || filters.form === ""}
                        onChange={() => handleFilterChange("form", "")}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Both</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="form"
                        checked={filters.form === "coil"}
                        onChange={() => handleFilterChange("form", "coil")}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Coil</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="form"
                        checked={filters.form === "sheet"}
                        onChange={() => handleFilterChange("form", "sheet")}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Sheet</span>
                    </label>
                  </div>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {/* Range Filters */}
      <SidebarGroup>
        <SidebarGroupLabel>Dimensions</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="space-y-3 p-2">
                {/* Thickness */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Thickness Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.minThickness || ""}
                      onChange={(e) =>
                        handleFilterChange("minThickness", e.target.value)
                      }
                      placeholder="Min"
                      className="h-8"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.maxThickness || ""}
                      onChange={(e) =>
                        handleFilterChange("maxThickness", e.target.value)
                      }
                      placeholder="Max"
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Width */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Width Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.minWidth || ""}
                      onChange={(e) =>
                        handleFilterChange("minWidth", e.target.value)
                      }
                      placeholder="Min"
                      className="h-8"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.maxWidth || ""}
                      onChange={(e) =>
                        handleFilterChange("maxWidth", e.target.value)
                      }
                      placeholder="Max"
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Weight Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.minWeight || ""}
                      onChange={(e) =>
                        handleFilterChange("minWeight", e.target.value)
                      }
                      placeholder="Min"
                      className="h-8"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={filters.maxWeight || ""}
                      onChange={(e) =>
                        handleFilterChange("maxWeight", e.target.value)
                      }
                      placeholder="Max"
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>{" "}
      {/* Status Filter */}
      <SidebarGroup>
        <SidebarGroupLabel>Status</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="space-y-2 p-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Sold Status
                  </Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="soldStatus"
                        checked={
                          !filters.showSoldOnly && !filters.showUnsoldOnly
                        }
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showSoldOnly: false,
                            showUnsoldOnly: false,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">All</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="soldStatus"
                        checked={filters.showSoldOnly}
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showSoldOnly: true,
                            showUnsoldOnly: false,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Sold Only</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="soldStatus"
                        checked={filters.showUnsoldOnly}
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showSoldOnly: false,
                            showUnsoldOnly: true,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Unsold Only</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    DC Status
                  </Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dcStatus"
                        checked={!filters.showDCOnly && !filters.showNonDCOnly}
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showDCOnly: false,
                            showNonDCOnly: false,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">All</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dcStatus"
                        checked={filters.showDCOnly}
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showDCOnly: true,
                            showNonDCOnly: false,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">DC Only</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="dcStatus"
                        checked={filters.showNonDCOnly}
                        onChange={() => {
                          onFilterChange({
                            ...filters,
                            showDCOnly: false,
                            showNonDCOnly: true,
                          });
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-sm">Non-DC Only</span>
                    </label>
                  </div>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>        </SidebarGroupContent>
      </SidebarGroup>
      </div>
    </div>
  );
}
